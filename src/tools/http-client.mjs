// HTTP client for backend calls.
//
//   callBlog      -> community user-facing (/agent/blog/**), injects AK/SK
//   callShow      -> public read-only (/agent/show/**), no auth
//
// All responses are unwrapped from the backend's ApiResponse{code,message,data}
// into the toolkit result shape (see errors.mjs).

import { request } from 'undici';
import { BACKEND_BASE, REGION, DEFAULT_TIMEOUT_MS } from '../config.mjs';
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
    return { transportError: e.message, method, path };
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
  return { status: res.statusCode, json, text, method, path };
}

const BODY_SNIPPET_MAX = 200;

// Truncate an upstream body for error message context. Only the raw body is
// included — request headers (AK/SK etc.) are never echoed.
function bodySnippet(text) {
  if (!text) return '';
  const t = String(text).trim();
  if (!t) return '';
  const cut = t.length > BODY_SNIPPET_MAX ? `${t.slice(0, BODY_SNIPPET_MAX)}...` : t;
  return ` | body: ${cut}`;
}

function errorContext(resp) {
  return `${resp.method || 'GET'} ${resp.path || ''}`;
}

/** Unwrap a backend response into the toolkit result shape (test seam: exported). */
export function unwrap(resp) {
  if (resp.transportError) {
    return fail(
      CODES.UPSTREAM_ERROR,
      `${CODES.UPSTREAM_ERROR}: ${errorContext(resp)} -> 连接失败: ${resp.transportError}`,
    );
  }
  const { status, json, text } = resp;
  if (json && typeof json === 'object' && Object.hasOwn(json, 'code')) {
    if (json.code === 0) return ok(json.data);
    const code = mapBackendError(status, json.code);
    return fail(code, `${code}: ${errorContext(resp)} -> HTTP ${status} ${json.message || 'request failed'}${bodySnippet(text)}`);
  }
  if (status >= 200 && status < 300) return ok(json);
  const code = mapBackendError(status, null);
  const hasJsonMessage = Boolean(json && json.message);
  const upstream = hasJsonMessage ? `${json.message}${bodySnippet(text)}` : (text || '').trim().slice(0, BODY_SNIPPET_MAX);
  return fail(code, `${code}: ${errorContext(resp)} -> HTTP ${status} ${upstream}`.trim());
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
