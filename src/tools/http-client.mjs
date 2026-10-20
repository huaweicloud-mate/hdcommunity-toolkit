// HTTP client for backend calls.
//
// Three lanes:
//   callBlog  -> user-facing, injects AK/SK headers per request
//   callShow  -> public read-only, no auth
//   callAdmin -> admin, Bearer token (session cache or explicit)
//
// All responses are unwrapped from the backend's ApiResponse{code,message,data}
// into the toolkit result shape (see errors.mjs).

import { request } from 'undici';
import { BACKEND, ADMIN_LOGIN_PATH, ADMIN_LOGOUT_PATH, REGION, DEFAULT_TIMEOUT_MS } from '../config.mjs';
import { loadCredentials, hasCredentials } from '../credentials.mjs';
import { ok, fail, mapBackendError, CODES } from '../errors.mjs';
import { getSessionToken } from '../session.mjs';

function buildUrl(base, path, query) {
  const url = new URL(base.replace(/\/$/, '') + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url;
}

async function doRequest(base, path, { method = 'GET', query, body, headers } = {}) {
  const url = buildUrl(base, path, query);
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
  return unwrap(await doRequest(BACKEND.blog, path, { method, query, body, headers }));
}

/** Public read-only call — no auth. */
export async function callShow(method, path, { query, body } = {}) {
  return unwrap(await doRequest(BACKEND.blog, path, { method, query, body }));
}

/**
 * Admin call — Bearer token from explicit arg or session cache.
 * @param {string} sessionId
 * @param {string} method
 * @param {string} path
 * @param {{query?: object, body?: object, token?: string}} [opts]
 */
export async function callAdmin(sessionId, method, path, { query, body, token } = {}) {
  const t = token || getSessionToken(sessionId);
  if (!t) return fail(CODES.UNAUTHORIZED, '管理面未登录：请先调用 hdcommunity_admin_login');
  return unwrap(
    await doRequest(BACKEND.blogmng, path, { method, query, body, headers: { Authorization: `Bearer ${t}` } }),
  );
}

/** Admin login — no bearer required. */
export async function loginAdmin(username, password) {
  return unwrap(await doRequest(BACKEND.blogmng, ADMIN_LOGIN_PATH, { method: 'POST', body: { username, password } }));
}

/** Admin logout — revokes the token on the backend. */
export async function logoutAdmin(sessionId, token) {
  const t = token || getSessionToken(sessionId);
  if (!t) return ok(null);
  return unwrap(
    await doRequest(BACKEND.blogmng, ADMIN_LOGOUT_PATH, { method: 'POST', headers: { Authorization: `Bearer ${t}` } }),
  );
}