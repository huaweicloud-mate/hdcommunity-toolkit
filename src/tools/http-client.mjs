// HTTP client for backend calls (single merged backend service).
//
//   callBlog  -> user-facing, injects AK/SK headers per request
//   callShow  -> public read-only, no auth
//   callAdmin -> admin, Bearer token (session cache or explicit)
//   loginAdmin / logoutAdmin -> real /manage/auth/* endpoints
//
// All responses are unwrapped from the backend's ApiResponse{code,message,data}
// into the toolkit result shape (see errors.mjs).

import { request } from 'undici';
import { BACKEND_BASE, ADMIN_LOGIN_PATH, ADMIN_LOGOUT_PATH, REGION, DEFAULT_TIMEOUT_MS, HDGROW_BASE } from '../config.mjs';
import {
  loadCredentials,
  hasCredentials,
  loadAdminCredentials,
  hasAdminCredentials,
  loadGrowAppCode,
} from '../credentials.mjs';
import { ok, fail, mapBackendError, CODES } from '../errors.mjs';
import { getSessionToken, setSessionToken, clearSessionToken } from '../session.mjs';
import { getGrowToken } from '../session.mjs';

function buildUrl(path, query) {
  const url = new URL(BACKEND_BASE.replace(/\/$/, '') + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url;
}

async function doRequest(path, { method = 'GET', query, body, headers } = {}) {
  const url = buildUrl(path, query);
  let res;
  try {
    res = await request(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      bodyTimeout: DEFAULT_TIMEOUT_MS,
      headersTimeout: DEFAULT_TIMEOUT_MS,
    });
  } catch (e) {
    return { transportError: e.message };
  }
  const text = await res.body.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
  }
  return { status: res.statusCode, json, text };
}

function unwrap(resp) {
  if (resp.transportError) {
    return fail(CODES.UPSTREAM_ERROR, `无法连接后端服务: ${resp.transportError}`);
  }
  const { status, json, text } = resp;
  if (json && typeof json === 'object' && Object.hasOwn(json, 'code')) {
    if (json.code === 0) return ok(json.data);
    return fail(mapBackendError(status, json.code), json.message || 'request failed');
  }
  if (status >= 200 && status < 300) return ok(json);
  return fail(mapBackendError(status, null), (json && json.message) || text || `HTTP ${status}`);
}

/**
 * User-facing call — injects AK/SK headers per request.
 * @param {string} method
 * @param {string} path  e.g. "/agent/blog/list"
 * @param {{query?: object, body?: object}} [opts]
 */
export async function callBlog(method, path, { query, body } = {}) {
  const creds = loadCredentials();
  if (!hasCredentials(creds)) {
    return fail(
      CODES.AUTH_MISSING,
      '未配置 AK/SK：请设置 HW_ACCESS_KEY/HW_SECRET_KEY，或配置 ~/.config/huaweicloud/credentials.json',
    );
  }
  const headers = {
    'X-HW-AK': creds.ak,
    'X-HW-SK': creds.sk,
    'X-HW-PROJECT-ID': creds.projectId || '',
    'X-HW-REGION': creds.region || REGION,
  };
  if (creds.securityToken) headers['X-HW-Security-Token'] = creds.securityToken;
  return unwrap(await doRequest(path, { method, query, body, headers }));
}

/** Public read-only call — no auth. */
export async function callShow(method, path, { query, body } = {}) {
  return unwrap(await doRequest(path, { method, query, body }));
}

const NEED_LOGIN_HINT =
  '管理面登录态失效且无法自动重登：请配置 HDCOMMUNITY_ADMIN_USER / HDCOMMUNITY_ADMIN_PASS 环境变量' +
  '（或在 ~/.config/huaweicloud/credentials.json 写入 admin_user/admin_pass），或调用 hdcommunity_admin_login';

/**
 * Attempt an automatic relogin with configured admin credentials (B1).
 * @returns {Promise<null|{ok:false}>} null = relogin succeeded (new token cached); otherwise a NEED_LOGIN failure.
 */
async function autoRelogin(sessionId) {
  const creds = loadAdminCredentials();
  if (!hasAdminCredentials(creds)) {
    return fail(CODES.NEED_LOGIN, NEED_LOGIN_HINT);
  }
  clearSessionToken(sessionId);
  const r = await loginAdmin(creds.adminUser, creds.adminPass);
  if (!r.ok) {
    return fail(CODES.NEED_LOGIN, `401 自动重登失败（${r.error?.message || r.error?.code}）：请核对 HDCOMMUNITY_ADMIN_USER/PASS 配置，或调用 hdcommunity_admin_login`);
  }
  const d = r.data || {};
  const user = d.user || {};
  setSessionToken(sessionId, { token: d.token, username: user.username, role: user.role });
  return null;
}

async function adminRequest(token, method, path, { query, body } = {}) {
  return unwrap(await doRequest(path, { method, query, body, headers: { Authorization: `Bearer ${token}` } }));
}

/**
 * Admin call — Bearer token from explicit arg or session cache.
 * B1: on 401/UNAUTHORIZED (and when no explicit token was passed), automatically relogin once
 * with configured admin credentials and retry the request; only report NEED_LOGIN when that fails.
 * @param {string} sessionId
 * @param {string} method
 * @param {string} path
 * @param {{query?: object, body?: object, token?: string}} [opts]
 */
export async function callAdmin(sessionId, method, path, { query, body, token } = {}) {
  if (token) return adminRequest(token, method, path, { query, body });

  let t = getSessionToken(sessionId);
  if (!t) {
    const reloginFailure = await autoRelogin(sessionId);
    if (reloginFailure) return reloginFailure;
    t = getSessionToken(sessionId);
  }

  let result = await adminRequest(t, method, path, { query, body });
  if (!result.ok && result.error?.code === CODES.UNAUTHORIZED) {
    const reloginFailure = await autoRelogin(sessionId);
    if (reloginFailure) return reloginFailure;
    const fresh = getSessionToken(sessionId);
    result = await adminRequest(fresh, method, path, { query, body });
  }
  return result;
}

/** Admin login — real /manage/auth/login, no bearer required. */
export async function loginAdmin(username, password) {
  return unwrap(await doRequest(ADMIN_LOGIN_PATH, { method: 'POST', body: { username, password } }));
}

/** Admin logout — revokes the token on the backend. */
export async function logoutAdmin(sessionId, token) {
  const t = token || getSessionToken(sessionId);
  if (!t) return ok(null);
  return unwrap(await doRequest(ADMIN_LOGOUT_PATH, { method: 'POST', headers: { Authorization: `Bearer ${t}` } }));
}

// ---------------------------------------------------------------------------
// Growth center (HDGrowService) — separate base (context-path /api/v1/hdgrowservice).
//
//   callGrowShow   -> /servlet/**  public read-only, no auth
//   callGrowServer -> /server/**   service-to-service, injects X-Apig-AppCode
// ---------------------------------------------------------------------------

function buildGrowUrl(path, query) {
  const url = new URL(HDGROW_BASE.replace(/\/$/, '') + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url;
}

async function doGrowRequest(path, { method = 'GET', query, body, headers } = {}) {
  const url = buildGrowUrl(path, query);
  let res;
  try {
    res = await request(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      bodyTimeout: DEFAULT_TIMEOUT_MS,
      headersTimeout: DEFAULT_TIMEOUT_MS,
    });
  } catch (e) {
    return { transportError: e.message };
  }
  const text = await res.body.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
  }
  return { status: res.statusCode, json, text };
}

/** Growth public read-only call — no auth. */
export async function callGrowShow(method, path, { query, body } = {}) {
  return unwrap(await doGrowRequest(path, { method, query, body }));
}

const GROW_APPCODE_HINT =
  '未配置成长服务 appcode：请设置环境变量 HDGROW_APPCODE（或在 ~/.config/huaweicloud/credentials.json 写入 grow_appcode）。' +
  'appcode 由 APIG 网关发放，并经服务端 hd_grow_api_whitelist 白名单校验。';

/** Growth service-to-service call — injects X-Apig-AppCode per request. */
export async function callGrowServer(method, path, { query, body } = {}) {
  const appcode = loadGrowAppCode();
  if (!appcode) return fail(CODES.AUTH_MISSING, GROW_APPCODE_HINT);
  return unwrap(await doGrowRequest(path, { method, query, body, headers: { 'X-Apig-AppCode': appcode } }));
}

// ---------------------------------------------------------------------------
// Growth management console (/manage/**) — internal account login → Bearer token.
// Token cached per session in a dedicated namespace (getGrowToken).
// ---------------------------------------------------------------------------

const GROW_NEED_LOGIN =
  '管理台未登录：请先调用 hdgrow_admin_login { username, password }（内部账号，角色 operator/approver/admin）';

/** Growth management login — POST /manage/auth/login, no Bearer required. */
export async function loginGrowAdmin(username, password) {
  return unwrap(await doGrowRequest('/manage/auth/login', { method: 'POST', body: { username, password } }));
}

/** Growth management logout — revokes the token on the backend. */
export async function logoutGrowAdmin(sessionId, token) {
  const t = token || getGrowToken(sessionId);
  if (!t) return ok(null);
  return unwrap(await doGrowRequest('/manage/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${t}` } }));
}

/**
 * Growth management call — Bearer token from explicit arg or session cache.
 * No auto-relogin (unlike the community admin side): call hdgrow_admin_login explicitly.
 * @param {string} sessionId
 */
export async function callGrowAdmin(sessionId, method, path, { query, body, token } = {}) {
  const t = token || getGrowToken(sessionId);
  if (!t) return fail(CODES.NEED_LOGIN, GROW_NEED_LOGIN);
  return unwrap(await doGrowRequest(path, {
    method,
    query,
    body,
    headers: { Authorization: `Bearer ${t}` },
  }));
}