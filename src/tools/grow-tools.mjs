// Growth-center tools (hdgrow_*) — parallel capability to the community/blog side.
//
// Scope (Phase 0):
//   A. public read-only  /servlet/**  (no auth)          -> hdgrow_task_list / task_categories / prize_list
//   B. service-to-service /server/**  (X-Apig-AppCode)   -> *_query / *_tasks / *_prizes (read)
//                                                           points_add / prize_exchange / issue_coupon (write)
//
// Money-sensitive writes are guarded by a 4-step chain:
//   1. dry_run preview (default TRUE) — never writes; returns params + money + risk + a confirm_token
//   2. one-time confirm_token bound to the exact request body (HMAC, TTL 5min) — rejects tampered params
//   3. high-risk threshold gate — over limit requires confirm_high_risk=true + a non-empty reason
//   4. mandatory biz_id idempotency (issue_coupon / prize_exchange); no automatic retry
//
// NOTE: this is the *execution* side (business ops). The operations-console CONFIG side
// (task points / coupon quantity settings) is a separate management-console concern and is
// NOT exposed here (see PLAN_manage_console.md).

import crypto from 'node:crypto';
import { callGrowShow, callGrowServer } from './http-client.mjs';
import { ok, fail, CODES } from '../errors.mjs';

const P = {
  int: (d) => ({ type: 'integer', description: d }),
  str: (d) => ({ type: 'string', description: d }),
  bool: (d) => ({ type: 'boolean', description: d }),
};

// --- risk thresholds for money-sensitive writes (override via env) ---
const THRESHOLDS = {
  FACE_AMOUNT_MAX: Number(process.env.HDGROW_RISK_FACE_AMOUNT_MAX || 100), // 单张面额（元）
  QUANTITY_MAX: Number(process.env.HDGROW_RISK_QUANTITY_MAX || 10), // 单次券数量
};

// --- one-time confirm tokens (in-memory, per process) ---
const TOKEN_SECRET = crypto.randomBytes(32);
const TOKEN_TTL_MS = 5 * 60 * 1000;
const tokenStore = new Map(); // token -> { hash, exp }

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
function guardWrite({ action, method, endpoint, body, money, hits = [] }, args, exec) {
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

const FACE_RE = /^\d+(\.\d{1,2})?$/;

// ---------------------------------------------------------------------------
// Tool group
// ---------------------------------------------------------------------------

export const GROW_TOOLS = {
  definitions: [
    // --- A. public read-only (/servlet) ---
    {
      name: 'hdgrow_task_list',
      description:
        'List growth-center tasks (public, no auth). 成长中心任务列表（公开只读）。',
      inputSchema: {
        type: 'object',
        properties: {
          category_key: P.str('任务分类 key（可选）'),
          biz_type: P.str('业务类型筛选，如 opc/codearts（可选）'),
          show: P.bool('is_show 筛选：true 仅展示 / false 仅隐藏（可选）'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
        },
      },
    },
    {
      name: 'hdgrow_task_categories',
      description: 'List growth-center task categories (public, no auth). 成长中心任务分类（公开只读）。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hdgrow_prize_list',
      description: 'List growth-center prizes/coupons (public, no auth). 成长中心权益(代金券)列表（公开只读）。',
      inputSchema: {
        type: 'object',
        properties: { page_no: P.int('页码，默认 1'), page_size: P.int('每页条数，默认 10') },
      },
    },

    // --- B. service-to-service reads (/server, appcode) ---
    {
      name: 'hdgrow_points_query',
      description: 'Query a user current total points (service-to-service, appcode). 查询用户积分。',
      inputSchema: {
        type: 'object',
        required: ['domain_id'],
        properties: {
          domain_id: P.str('租户ID（产品侧保证主账号）'),
          user_type: P.str('MAIN(默认)/SUB；SUB 当期拦截'),
          iam_id: P.str('IAM 用户ID（MAIN 忽略，可选）'),
        },
      },
    },
    {
      name: 'hdgrow_server_tasks',
      description:
        'Query valid tasks via the server interface (appcode); with domain_id returns per-user finish status. 服务间查询任务列表。',
      inputSchema: {
        type: 'object',
        properties: {
          domain_id: P.str('传=登录态（返回 is_finish/completed_times）；空=仅基础字段'),
          user_type: P.str('MAIN(默认)'),
          iam_id: P.str('IAM 用户ID（MAIN 忽略，可选）'),
          category_id: P.str('任务分类筛选（可选）'),
          biz_type: P.str('业务类型筛选（可选）'),
          show: P.bool('is_show 筛选（可选）'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
        },
      },
    },
    {
      name: 'hdgrow_server_prizes',
      description:
        'Query prizes via the server interface (appcode); with domain_id returns per-user exchange fields. 服务间查询权益列表。',
      inputSchema: {
        type: 'object',
        properties: {
          domain_id: P.str('传=登录态（返回可兑换字段）；空=仅全局字段'),
          user_type: P.str('MAIN(默认)'),
          iam_id: P.str('IAM 用户ID（MAIN 忽略，可选）'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
        },
      },
    },

    // --- B. money-sensitive writes (dry_run guard) ---
    {
      name: 'hdgrow_points_add',
      description:
        'Issue points to a user after a task completes (appcode). MONEY-SENSITIVE: previews by default (dry_run=true); points value is derived by the backend from task_id. 发放积分（写，默认预演）。',
      inputSchema: {
        type: 'object',
        required: ['domain_id', 'task_id', 'completed_at'],
        properties: {
          domain_id: P.str('租户ID'),
          task_id: P.str('任务ID（即 task_tag）'),
          completed_at: P.int('用户实际完成时间（毫秒时间戳，支持补发）'),
          iam_id: P.str('IAM 用户ID（可选）'),
          domain_name: P.str('租户名（可选）'),
          user_type: P.str('MAIN(默认)/SUB（当期拦截）'),
          dry_run: P.bool('默认 true=仅预演（不执行）；false=执行（需 confirm_token）'),
          confirm_token: P.str('预演返回的确认令牌（执行时必传）'),
          reason: P.str('用途/审批说明（可选）'),
        },
      },
    },
    {
      name: 'hdgrow_prize_exchange',
      description:
        'Exchange a prize for a user via the server interface (appcode). MONEY-SENSITIVE: deducts points + stock and issues real coupons; previews by default. 兑换代金券（写，默认预演）。',
      inputSchema: {
        type: 'object',
        required: ['domain_id', 'prize_id', 'biz_id'],
        properties: {
          domain_id: P.str('租户ID（发券依赖）'),
          prize_id: P.str('权益(代金券)ID'),
          biz_id: P.str('产品侧唯一单号（幂等键 + 发券 biz_id，必填）'),
          quantity: P.int('单次数量，默认 1，最小 1'),
          iam_id: P.str('IAM 用户ID（MAIN 忽略，可选）'),
          user_type: P.str('MAIN(默认)/SUB（当期拦截）'),
          dry_run: P.bool('默认 true=仅预演（不执行）；false=执行（需 confirm_token）'),
          confirm_token: P.str('预演返回的确认令牌（执行时必传）'),
          confirm_high_risk: P.bool('数量超阈值时必须为 true'),
          reason: P.str('用途/审批说明（高风险时必填）'),
        },
      },
    },
    {
      name: 'hdgrow_issue_coupon',
      description:
        'Issue an incentive coupon by face amount (appcode). MOST MONEY-SENSITIVE: issues real value directly; previews by default. 发代金券（写，默认预演）。',
      inputSchema: {
        type: 'object',
        required: ['domain_id', 'face_amount', 'biz_id'],
        properties: {
          domain_id: P.str('主账号租户ID（接收代金券目标，即 customer_id）'),
          face_amount: P.str('代金券面额（元，字符串，如 "10.00"）'),
          currency_code: P.str('货币单位 ISO-4217，默认 CNY'),
          biz_id: P.str('业务幂等单号（即激励金 transaction_id，必填）'),
          dry_run: P.bool('默认 true=仅预演（不执行）；false=执行（需 confirm_token）'),
          confirm_token: P.str('预演返回的确认令牌（执行时必传）'),
          confirm_high_risk: P.bool('面额超阈值时必须为 true'),
          reason: P.str('用途/审批说明（高风险时必填）'),
        },
      },
    },
  ],

  call: {
    // --- A. public read-only ---
    'hdgrow_task_list': (a) =>
      callGrowShow('GET', '/servlet/tasks', {
        query: {
          category_key: a.category_key,
          biz_type: a.biz_type,
          show: a.show,
          page_no: a.page_no,
          page_size: a.page_size,
        },
      }),
    'hdgrow_task_categories': () => callGrowShow('GET', '/servlet/task/categories'),
    'hdgrow_prize_list': (a) =>
      callGrowShow('GET', '/servlet/prizes', { query: { page_no: a.page_no, page_size: a.page_size } }),

    // --- B. service reads ---
    'hdgrow_points_query': (a) =>
      callGrowServer('POST', '/server/points/query', {
        body: { domain_id: a.domain_id, user_type: a.user_type, iam_id: a.iam_id },
      }),
    'hdgrow_server_tasks': (a) =>
      callGrowServer('POST', '/server/tasks', {
        body: {
          domain_id: a.domain_id,
          user_type: a.user_type,
          iam_id: a.iam_id,
          category_id: a.category_id,
          biz_type: a.biz_type,
          show: a.show,
          page_no: a.page_no,
          page_size: a.page_size,
        },
      }),
    'hdgrow_server_prizes': (a) =>
      callGrowServer('POST', '/server/prizes', {
        body: {
          domain_id: a.domain_id,
          user_type: a.user_type,
          iam_id: a.iam_id,
          page_no: a.page_no,
          page_size: a.page_size,
        },
      }),

    // --- B. money-sensitive writes (guarded) ---
    'hdgrow_points_add': (a) => {
      const body = {
        domain_id: a.domain_id,
        iam_id: a.iam_id,
        domain_name: a.domain_name,
        user_type: a.user_type,
        task_id: a.task_id,
        completed_at: a.completed_at,
      };
      return guardWrite(
        {
          action: 'points_add',
          method: 'POST',
          endpoint: '/server/points/add',
          body,
          money: { note: '积分值由后端按 task_id 查询 hd_grow_task.points 决定，调用方不可传入', task_id: a.task_id },
          hits: [],
        },
        a,
        () => callGrowServer('POST', '/server/points/add', { body }),
      );
    },

    'hdgrow_prize_exchange': (a) => {
      const quantity = a.quantity === undefined || a.quantity === null ? 1 : Number(a.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return fail(CODES.PARAM_ERROR, 'quantity 必须为 ≥1 的整数');
      }
      const body = {
        domain_id: a.domain_id,
        prize_id: a.prize_id,
        biz_id: a.biz_id,
        quantity,
        iam_id: a.iam_id,
        user_type: a.user_type,
      };
      const hits = quantity > THRESHOLDS.QUANTITY_MAX ? [{ name: `quantity>${THRESHOLDS.QUANTITY_MAX}`, value: quantity }] : [];
      return guardWrite(
        {
          action: 'prize_exchange',
          method: 'POST',
          endpoint: '/server/prize/exchange',
          body,
          money: { quantity, note: '实际发券总额 = 单张面额 × quantity，由后端 prize 数据决定；扣积分 = points_price × quantity' },
          hits,
        },
        a,
        () => callGrowServer('POST', '/server/prize/exchange', { body }),
      );
    },

    'hdgrow_issue_coupon': (a) => {
      const currency = a.currency_code || 'CNY';
      if (!FACE_RE.test(String(a.face_amount)) || Number(a.face_amount) <= 0) {
        return fail(CODES.PARAM_ERROR, 'face_amount 必须为大于 0 的数字（最多两位小数，字符串，如 "10.00"）');
      }
      if (currency !== 'CNY') {
        return fail(CODES.PARAM_ERROR, `currency_code 暂只支持 CNY（收到 ${currency}）`);
      }
      const body = { domain_id: a.domain_id, face_amount: a.face_amount, currency_code: currency, biz_id: a.biz_id };
      const hits =
        Number(a.face_amount) > THRESHOLDS.FACE_AMOUNT_MAX
          ? [{ name: `face_amount>${THRESHOLDS.FACE_AMOUNT_MAX}`, value: Number(a.face_amount) }]
          : [];
      return guardWrite(
        {
          action: 'issue_coupon',
          method: 'POST',
          endpoint: '/server/issue-coupon',
          body,
          money: { face_amount: a.face_amount, currency_code: currency, total_face: a.face_amount },
          hits,
        },
        a,
        () => callGrowServer('POST', '/server/issue-coupon', { body }),
      );
    },
  },
};