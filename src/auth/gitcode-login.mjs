// Backend-initiated GitCode login flow.
//
// The backend owns the GitCode OAuth exchange. The toolkit only:
//   1. generates a state and starts a loopback callback server (127.0.0.1, random port);
//   2. opens the backend login URL in the browser (backend redirects to GitCode and back);
//   3. receives the one-time ticket/code on the loopback callback;
//   4. calls the backend exchange endpoint to obtain a community session token.
//
// No GitCode client id/secret is needed here, and no GitCode token is stored — only the
// community session token returned by the backend (see token-store.mjs).

import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { request } from 'undici';
import {
  BACKEND_BASE,
  GITCODE_LOGIN_PATH,
  GITCODE_EXCHANGE_PATH,
  GITCODE_LOGOUT_PATH,
  GITCODE_TICKET_PARAM,
  GITCODE_REDIRECT_URI,
  DEFAULT_TIMEOUT_MS,
  LOGIN_TIMEOUT_MS,
} from '../config.mjs';
import { ok, fail, CODES } from '../errors.mjs';

const CALLBACK_PATH = '/callback';

export function createState() {
  return crypto.randomBytes(16).toString('hex');
}

/** Build the backend login URL that starts the GitCode authorization. */
export function buildLoginUrl(state, redirectUri) {
  const url = new URL(BACKEND_BASE.replace(/\/$/, '') + GITCODE_LOGIN_PATH);
  if (redirectUri) url.searchParams.set('redirect_uri', redirectUri);
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

/** Best-effort browser launch. Returns false when no opener is available. */
export function openBrowser(url) {
  try {
    const platform = process.platform;
    let cmd;
    let args;
    if (platform === 'win32') {
      // 不能走 `cmd /c start <url>`：cmd 会把 URL 里的 & 当成命令分隔符，丢掉 state 等后续参数。
      cmd = 'powershell';
      args = ['-NoProfile', '-Command', `Start-Process '${String(url).replace(/'/g, "''")}'`];
    } else if (platform === 'darwin') {
      cmd = 'open';
      args = [url];
    } else {
      cmd = 'xdg-open';
      args = [url];
    }
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function unwrap(resp) {
  if (resp.transportError) {
    return fail(CODES.UPSTREAM_ERROR, `无法连接后端服务: ${resp.transportError}`);
  }
  const { status, json, text } = resp;
  if (json && typeof json === 'object' && Object.hasOwn(json, 'code')) {
    if (json.code === 0) return ok(json.data);
    return fail(CODES.AUTH_FAILED, json.message || `登录失败（code=${json.code}）`);
  }
  if (status >= 200 && status < 300) return ok(json);
  return fail(CODES.AUTH_FAILED, (json && json.message) || text || `HTTP ${status}`);
}

/**
 * Exchange a one-time ticket/code for a community session token.
 * @param {string} ticket
 * @param {{state?: string, redirectUri?: string}} [opts]
 */
export async function exchangeTicket(ticket, { state, redirectUri } = {}) {
  if (!ticket || !String(ticket).trim()) {
    return fail(CODES.PARAM_ERROR, '缺少 ticket/code：请先完成 GitCode 授权');
  }
  const body = { [GITCODE_TICKET_PARAM]: String(ticket) };
  if (state) body.state = state;
  const cb = redirectUri !== undefined ? redirectUri : GITCODE_REDIRECT_URI;
  if (cb) body.redirect_uri = cb;

  let resp;
  try {
    const res = await request(new URL(BACKEND_BASE.replace(/\/$/, '') + GITCODE_EXCHANGE_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      bodyTimeout: DEFAULT_TIMEOUT_MS,
      headersTimeout: DEFAULT_TIMEOUT_MS,
    });
    const text = await res.body.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON body */
      }
    }
    resp = { status: res.statusCode, json, text };
  } catch (e) {
    resp = { transportError: e.message };
  }
  return unwrap(resp);
}

/**
 * Run the loopback callback server and resolve with {ticket} (or an error).
 * Must await the `listening` event: `server.address()` is null until then.
 * @param {string} expectedState
 * @param {number} timeoutMs
 * @returns {Promise<{promise: Promise<{ticket: string}>, port: number, close: () => void}>}
 */
export async function startCallbackServer(expectedState, timeoutMs) {
  let timer;
  let settle;
  const promise = new Promise((resolve) => {
    settle = resolve;
  });

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const finish = (status, html, payload) => {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      if (timer) clearTimeout(timer);
      server.close();
      settle(payload);
    };

    if (u.pathname !== CALLBACK_PATH) {
      finish(404, '<h1>Not Found</h1>', { error: 'CALLBACK_PATH_MISMATCH' });
      return;
    }
    const gotState = u.searchParams.get('state') || '';
    if (!gotState || gotState !== expectedState) {
      finish(400, '<h1>登录失败</h1><p>state 校验失败，请重新登录。</p>', { error: 'STATE_MISMATCH' });
      return;
    }
    const ticket = u.searchParams.get(GITCODE_TICKET_PARAM) || u.searchParams.get('ticket') || u.searchParams.get('code');
    if (!ticket) {
      finish(400, '<h1>登录失败</h1><p>未收到授权票据，请重新登录。</p>', { error: 'TICKET_MISSING' });
      return;
    }
    finish(200, '<h1>登录成功</h1><p>可以关闭此页面，回到 Agent 继续操作。</p>', { ticket });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;

  timer = setTimeout(() => {
    server.close();
    settle({ error: 'TIMEOUT' });
  }, timeoutMs);

  return {
    promise,
    port,
    close: () => {
      if (timer) clearTimeout(timer);
      server.close();
    },
  };
}

/**
 * Best-effort server-side logout (token revoke). No-op when HDCOMMUNITY_GITCODE_LOGOUT_PATH is unset.
 * @param {string} token community session token
 */
export async function revokeToken(token) {
  if (!GITCODE_LOGOUT_PATH || !token) return { skipped: true };
  try {
    const res = await request(new URL(BACKEND_BASE.replace(/\/$/, '') + GITCODE_LOGOUT_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      bodyTimeout: DEFAULT_TIMEOUT_MS,
      headersTimeout: DEFAULT_TIMEOUT_MS,
    });
    await res.body.text();
    return { status: res.statusCode };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Full login: start callback, open browser, wait for the ticket, exchange it.
 * @param {{timeoutMs?: number, openBrowser?: boolean}} [opts]
 * @returns {Promise<{ok:boolean, data?:object, error?:{code:string,message:string}}>}
 */
export async function loginWithBrowser({ timeoutMs = LOGIN_TIMEOUT_MS, openBrowser: launch = true } = {}) {
  const state = createState();
  const cb = await startCallbackServer(state, timeoutMs);
  const redirectUri = `http://127.0.0.1:${cb.port}${CALLBACK_PATH}`;
  const loginUrl = buildLoginUrl(state, redirectUri);
  const browserOpened = launch ? openBrowser(loginUrl) : false;

  const result = await cb.promise;
  if (result.error) {
    const messages = {
      STATE_MISMATCH: '登录失败：state 校验失败',
      TICKET_MISSING: '登录失败：未收到授权票据',
      CALLBACK_PATH_MISMATCH: '登录失败：回调路径错误',
      TIMEOUT: `登录超时（${Math.round(timeoutMs / 1000)} 秒）：请重试，或使用手动模式（wait=false 后传 ticket）`,
    };
    return fail(result.error === 'TIMEOUT' ? CODES.AUTH_FAILED : CODES.PARAM_ERROR, messages[result.error] || '登录失败');
  }

  const ex = await exchangeTicket(result.ticket, { state, redirectUri });
  if (!ex.ok) return ex;
  return ok({ ...ex.data, browser_opened: browserOpened, login_url: loginUrl });
}