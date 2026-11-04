// HTTP client for backend calls.
//
//   callBlog      -> community user-facing (/agent/blog/**), injects AK/SK
//   callShow      -> public read-only (/agent/show/**), no auth
//   callGrowShow  -> growth public read-only (/agent/show/grow/**), no auth
//
// (Business-side and management-console clients live in hdcommunity-mng-toolkit.)
//
// All responses are unwrapped from the backend's ApiResponse{code,message,data}
// into the toolkit result shape (see errors.mjs).

import { request } from 'undici';
import { BACKEND_BASE, REGION, DEFAULT_TIMEOUT_MS, growBase } from '../config.mjs';
import { loadCredentials, hasCredentials } from '../credentials.mjs';
import { ok, fail, mapBackendError, CODES } from '../errors.mjs';

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

/** Community user-facing call — injects AK/SK headers per request. */
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

/** Community public read-only call — no auth. */
export async function callShow(method, path, { query, body } = {}) {
  return unwrap(await doRequest(path, { method, query, body }));
}

// ---------------------------------------------------------------------------
// Growth center (HDGrowService) — separate base (context-path /api/v1/hdgrowservice).
//   callGrowShow -> /agent/show/grow/**  public read-only, no auth
// ---------------------------------------------------------------------------

const GROW_BASE_HINT =
  '未配置成长服务地址：请设置 HDGROW_BASE，形如 https://<网关>/api/v1/hdgrowservice（无默认值，禁用隐式环境）';

function buildGrowUrl(path, query) {
  const base = growBase();
  if (!base) {
    throw new Error('HDGROW_BASE 未配置（空值）');
  }
  const url = new URL(base.replace(/\/$/, '') + path);
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
  if (!growBase()) return fail(CODES.CONFIG_MISSING, GROW_BASE_HINT);
  return unwrap(await doGrowRequest(path, { method, query, body }));
}
