// Shared money-safety guard for user self-service writes (e.g. hdgrow_user_prize_exchange).
//
// 4-step chain:
//   1. dry_run preview (default TRUE) — never writes; returns params + money + risk + a confirm_token
//   2. one-time confirm_token bound to the exact request body (HMAC, TTL 5min) — rejects tampered params
//   3. high-risk threshold gate — over limit requires confirm_high_risk=true + a non-empty reason
//   4. mandatory biz_id idempotency is enforced by the calling tool
//
// Operator-side business writes live in hdcommunity-mng-toolkit and bring their own guard copy there.

import crypto from 'node:crypto';
import { ok, fail, CODES } from '../errors.mjs';

// --- risk thresholds for money-sensitive writes (override via env) ---
export const THRESHOLDS = {
  FACE_AMOUNT_MAX: Number(process.env.HDGROW_RISK_FACE_AMOUNT_MAX || 100), // 单张面额（元）
  QUANTITY_MAX: Number(process.env.HDGROW_RISK_QUANTITY_MAX || 10), // 单次券数量
};

// --- one-time confirm tokens (in-memory, per process) ---
const TOKEN_SECRET = crypto.randomBytes(32);
const TOKEN_TTL_MS = 5 * 60 * 1000;
const TOKEN_MAX = Number(process.env.HDGROW_CONFIRM_TOKEN_MAX || 500);
const tokenStore = new Map(); // token -> { hash, exp }

/** 清理过期令牌，并限制总量（防长驻进程内存增长）。 */
function sweepTokens() {
  const now = Date.now();
  for (const [k, v] of tokenStore) {
    if (v.exp < now) tokenStore.delete(k);
  }
  while (tokenStore.size > TOKEN_MAX) {
    const oldest = tokenStore.keys().next().value;
    tokenStore.delete(oldest);
  }
}

function canonicalHash(obj) {
  const norm = (v) => {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return v.map(norm);
    if (typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = norm(v[k]);
      return out;
    }
    return v;
  };
  return crypto.createHash('sha256').update(JSON.stringify(norm(obj))).digest('hex');
}

function issueToken(body) {
  sweepTokens();
  const hash = canonicalHash(body);
  const exp = Date.now() + TOKEN_TTL_MS;
  const token = crypto.createHmac('sha256', TOKEN_SECRET).update(`${hash}|${exp}`).digest('hex').slice(0, 32);
  tokenStore.set(token, { hash, exp });
  return { token, exp };
}

function consumeToken(token, body) {
  if (!token) return { ok: false, message: '缺少 confirm_token：请先以 dry_run（默认）预演，拿到 confirm_token 后再执行' };
  const rec = tokenStore.get(token);
  if (!rec) return { ok: false, message: 'confirm_token 无效或已被使用（一次性）' };
  if (Date.now() > rec.exp) {
    tokenStore.delete(token);
    return { ok: false, message: 'confirm_token 已过期（TTL 5 分钟），请重新预演' };
  }
  if (canonicalHash(body) !== rec.hash) {
    return { ok: false, message: 'confirm_token 与当前参数不匹配：参数在预演后被改动，请重新预演' };
  }
  tokenStore.delete(token); // one-time
  return { ok: true };
}

function moneyPreview(action, method, endpoint, body, money, hits, token, exp) {
  return {
    preview: true,
    action,
    method,
    endpoint,
    params: body,
    money,
    risk_level: hits.length ? 'HIGH' : 'MID',
    threshold_hits: hits,
    confirm_token: token,
    expires_in_s: Math.round((exp - Date.now()) / 1000),
    next: '确认无误后再次调用本工具，传 dry_run=false 与 confirm_token 执行；若 risk_level=HIGH，需再传 confirm_high_risk=true 与 reason。',
  };
}

/**
 * Shared guard for money-sensitive writes.
 * @param {object} opts { action, method, endpoint, body, money, hits }
 * @param {object} args original tool args (dry_run / confirm_token / confirm_high_risk / reason)
 * @param {() => Promise<object>} exec real backend call
 */
export function guardWrite({ action, method, endpoint, body, money, hits = [] }, args, exec) {
  if (args.dry_run !== false) {
    const { token, exp } = issueToken(body);
    return ok(moneyPreview(action, method, endpoint, body, money, hits, token, exp));
  }
  const tv = consumeToken(args.confirm_token, body);
  if (!tv.ok) return fail(CODES.PARAM_ERROR, tv.message);
  if (hits.length) {
    const names = hits.map((h) => h.name).join('、');
    if (args.confirm_high_risk !== true) {
      return fail(CODES.PARAM_ERROR, `高风险操作（${names} 超阈值）：需 confirm_high_risk=true 且提供 reason`);
    }
    if (!args.reason || !String(args.reason).trim()) {
      return fail(CODES.PARAM_ERROR, '高风险操作需提供非空 reason（用途/审批说明）');
    }
  }
  return exec();
}