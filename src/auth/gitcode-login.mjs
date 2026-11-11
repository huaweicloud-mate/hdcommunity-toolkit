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
  GITCODE_POLL_PATH,
  GITCODE_REMOTE_START_PATH,
  DEFAULT_TIMEOUT_MS,
  LOGIN_TIMEOUT_MS,
  LOGIN_URL_GRACE_MS,
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

// opener 正常拉起后很快以 0 退出；超过该窗口仍存活（部分平台 opener 常驻）即视为已拉起。
const BROWSER_LAUNCH_GRACE_MS = 1500;

/** 按平台解析打开浏览器所用的命令。 */
function browserCommand(platform, url) {
  if (platform === 'win32') {
    // 不能走 `cmd /c start <url>`：cmd 会把 URL 里的 & 当成命令分隔符，丢掉 state 等后续参数。
    return { cmd: 'powershell', args: ['-NoProfile', '-Command', `Start-Process '${String(url).replace(/'/g, "''")}'`] };
  }
  if (platform === 'darwin') return { cmd: 'open', args: [String(url)] };
  return { cmd: 'xdg-open', args: [String(url)] };
}

/**
 * Best-effort browser launch.
 * spawn 的返回值无法判断浏览器是否真的拉起（stdio: 'ignore' 时错误只从 error 事件暴露，
 * 某些平台 opener 还会以非 0 退出），因此监听子进程 error / exit：
 * spawn 失败（如 Windows 无 powershell、Linux 无 xdg-open）或非 0 退出 → false，
 * 调用方据此把 login_url 交给用户手动打开。
 * @param {string} url
 * @param {{platform?: string, cmd?: string, args?: string[], graceMs?: number}} [opts] cmd/args/graceMs 仅用于单测注入
 * @returns {Promise<boolean>}
 */
export function openBrowser(url, { platform = process.platform, cmd, args, graceMs = BROWSER_LAUNCH_GRACE_MS } = {}) {
  return new Promise((resolve) => {
    let spec;
    try {
      spec = cmd ? { cmd, args: args || [String(url)] } : browserCommand(platform, url);
    } catch {
      resolve(false);
      return;
    }

    let child;
    try {
      child = spawn(spec.cmd, spec.args, { detached: true, stdio: 'ignore' });
    } catch {
      resolve(false);
      return;
    }

    let settled = false;
    let timer;
    const onError = () => finish(false);
    const onExit = (code) => finish(code === 0);
    function finish(launched) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.removeListener('error', onError);
      child.removeListener('exit', onExit);
      if (launched) {
        try {
          child.unref();
        } catch {
          /* already gone */
        }
      }
      resolve(launched);
    }

    child.once('error', onError);
    child.once('exit', onExit);
    timer = setTimeout(() => finish(true), graceMs);
    if (typeof timer.unref === 'function') timer.unref();
  });
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

const TIMED_OUT = Symbol('login-timed-out');

/** 等待登录结果，超过 timeoutMs 视为超时（回环服务由调用方继续持有）。 */
async function waitForOutcome(promise, timeoutMs) {
  let timer;
  const guard = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
  });
  try {
    return await Promise.race([promise, guard]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Full login: start callback, open browser, wait for the ticket, exchange it.
 *
 * 浏览器拉不起来时不再空等到超时：立即返回 browser_opened:false + login_url，并把
 * 回环服务多保留 graceMs，onBrowserUnopened 可在后台继续等票据、换票、落盘
 * （用户手动打开 login_url 完成授权后同一回环服务即可收到 ticket）。
 * @param {{timeoutMs?: number, graceMs?: number, openBrowser?: boolean, launcher?: (url: string) => Promise<boolean>,
 *          onBrowserUnopened?: (ctx: {state: string, redirectUri: string, loginUrl: string, result: Promise<any>}) => any}} [opts]
 * @returns {Promise<{ok:boolean, data?:object, error?:{code:string,message:string}}>}
 */
export async function loginWithBrowser({
  timeoutMs = LOGIN_TIMEOUT_MS,
  graceMs = LOGIN_URL_GRACE_MS,
  openBrowser: launch = true,
  launcher = openBrowser,
  onBrowserUnopened = null,
} = {}) {
  const waitMs = Math.max(0, Number(timeoutMs) || 0);
  const grace = Math.max(0, Number(graceMs) || 0);
  const state = createState();
  // 回环服务比工具等待窗口多活一个 grace 窗口，保证返回给用户的 login_url 仍可授权。
  const cb = await startCallbackServer(state, waitMs + grace);
  const redirectUri = `http://127.0.0.1:${cb.port}${CALLBACK_PATH}`;
  const loginUrl = buildLoginUrl(state, redirectUri);
  const browserOpened = launch ? await launcher(loginUrl) : false;

  const keepWaiting = () => {
    if (typeof onBrowserUnopened !== 'function') return;
    Promise.resolve()
      .then(() => onBrowserUnopened({ state, redirectUri, loginUrl, result: cb.promise }))
      .catch(() => {});
  };
  const fallbackFields = { browser_opened: browserOpened, login_url: loginUrl };
  const manualHint = (seconds) =>
    seconds > 0
      ? `请在浏览器中手动打开该地址完成 GitCode 授权（约 ${seconds} 秒内仍有效，票据到达后会话自动保存）`
      : '请重新调用 hdcommunity_auth_login 重试';

  if (launch && !browserOpened) {
    // 关键修复：浏览器没起来时立即把 login_url 交给调用方，避免 MCP 请求静默超时。
    keepWaiting();
    return fail(
      CODES.AUTH_FAILED,
      `浏览器未能自动打开。${manualHint(Math.round((waitMs + grace) / 1000))}：${loginUrl}`,
      fallbackFields,
    );
  }

  const outcome = await waitForOutcome(cb.promise, waitMs);
  if (outcome === TIMED_OUT || (outcome && outcome.error === 'TIMEOUT')) {
    keepWaiting();
    return fail(
      CODES.AUTH_FAILED,
      `登录超时（${Math.round(waitMs / 1000)} 秒）：未收到授权回调。${manualHint(Math.round(grace / 1000))}：${loginUrl}`,
      fallbackFields,
    );
  }

  const result = outcome;
  if (result.error) {
    const messages = {
      STATE_MISMATCH: '登录失败：state 校验失败，请重新调用 hdcommunity_auth_login',
      TICKET_MISSING: '登录失败：未收到授权票据，请重新调用 hdcommunity_auth_login',
      CALLBACK_PATH_MISMATCH: '登录失败：回调路径错误，请重新调用 hdcommunity_auth_login',
    };
    return fail(CODES.PARAM_ERROR, messages[result.error] || '登录失败', { browser_opened: browserOpened });
  }

  const ex = await exchangeTicket(result.ticket, { state, redirectUri });
  if (!ex.ok) return ex;
  return ok({ ...ex.data, browser_opened: browserOpened, login_url: loginUrl });
}
/**
 * 远程模式（跨机器）：向后端申请一次性登录会话。
 * 返回 { login_url, state, poll_key, expires_in }；poll_key 只给插件，不要放进 URL/二维码。
 */
export async function startRemoteSession() {
  let resp;
  try {
    const res = await request(new URL(BACKEND_BASE.replace(/\/$/, '') + GITCODE_REMOTE_START_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
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
  const r = unwrap(resp);
  if (!r.ok) return r;
  const d = r.data || {};
  if (!d.login_url || !d.poll_key) {
    return fail(CODES.AUTH_FAILED, '后端未返回远程登录参数（login_url/poll_key）');
  }
  return ok({ login_url: d.login_url, state: d.state, poll_key: d.poll_key, expires_in: d.expires_in });
}

/**
 * 远程模式：用 poll_key 轮询后端登录结果（pending / token / error）。
 * @param {string} pollKey
 */
export async function pollRemote(pollKey) {
  if (!pollKey || !String(pollKey).trim()) {
    return fail(CODES.PARAM_ERROR, '缺少 poll_key');
  }
  let resp;
  try {
    const res = await request(new URL(BACKEND_BASE.replace(/\/$/, '') + GITCODE_POLL_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poll_key: String(pollKey) }),
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
