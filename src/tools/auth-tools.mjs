// Authentication tools (hdcommunity_auth_*): backend-initiated GitCode login.
//
// Flow: browser -> backend -> GitCode -> backend -> loopback callback (ticket) -> exchange.
// Only the community session token is stored locally (0600); no GitCode secret is kept.

import {
  AUTH_MODE,
  GITCODE_REDIRECT_URI,
  LOGIN_TIMEOUT_MS,
} from '../config.mjs';
import {
  buildLoginUrl,
  createState,
  exchangeTicket,
  loginWithBrowser,
  revokeToken,
} from '../auth/gitcode-login.mjs';
import {
  authFilePath,
  clearSession,
  getActiveSession,
  getValidSession,
  listAccounts,
  saveSession,
} from '../auth/token-store.mjs';
import { ok, fail, CODES } from '../errors.mjs';

const P = {
  int: (d) => ({ type: 'integer', description: d }),
  str: (d) => ({ type: 'string', description: d }),
  bool: (d) => ({ type: 'boolean', description: d }),
};

function sessionView(session) {
  if (!session) return null;
  return {
    account: session.key,
    user: session.user || {},
    saved_at: session.savedAt || null,
    expires_at: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
  };
}

function persist(ex) {
  const data = ex.data || {};
  const token = data.token || data.access_token;
  if (!token) return fail(CODES.AUTH_FAILED, '后端未返回会话 token');
  const { key, rec } = saveSession({ token, user: data.user, expiresIn: data.expires_in });
  return ok({
    logged_in: true,
    account: key,
    user: rec.user,
    expires_at: rec.expiresAt ? new Date(rec.expiresAt).toISOString() : null,
  });
}

export const AUTH_TOOLS = {
  definitions: [
    {
      name: 'hdcommunity_auth_login',
      description:
        'Log in with a GitCode account (backend-initiated OAuth). Opens the browser and waits for the callback by default. 使用 GitCode 账号登录。',
      inputSchema: {
        type: 'object',
        properties: {
          ticket: P.str('手动模式：GitCode 授权回调里的 ticket/code（与 wait=false 配合）'),
          code: P.str('同 ticket（别名，兼容回调参数名为 code 的场景）'),
          wait: P.bool('默认 true：打开浏览器并等待回调；false：只返回授权 URL'),
          open_browser: P.bool('默认 true：自动打开浏览器'),
          timeout_s: P.int(`等待回调的秒数（默认 ${Math.round(LOGIN_TIMEOUT_MS / 1000)}）`),
          force: P.bool('默认 false：已登录时直接返回当前登录态'),
        },
      },
    },
    {
      name: 'hdcommunity_auth_status',
      description: 'Show the current auth mode and GitCode login state. 查看登录状态。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hdcommunity_auth_logout',
      description: 'Log out locally (and revoke server-side when configured). 退出登录。',
      inputSchema: {
        type: 'object',
        properties: { all: P.bool('默认 false：仅清除当前账号；true：清除全部本地会话') },
      },
    },
  ],

  call: {
    'hdcommunity_auth_login': async (a) => {
      const manual = a.ticket || a.code;
      if (manual) {
        const ex = await exchangeTicket(manual);
        if (!ex.ok) return ex;
        return persist(ex);
      }

      if (!a.force) {
        const s = getValidSession();
        if (s) return ok({ already_logged_in: true, ...sessionView(s) });
      }

      if (a.wait === false) {
        // 手动模式必须有回调地址：后端要用它把一次性票据送回插件；缺了会直接 400「缺少 redirect_uri」。
        if (!GITCODE_REDIRECT_URI) {
          return fail(
            CODES.PARAM_ERROR,
            '手动模式需要配置 HDCOMMUNITY_GITCODE_REDIRECT_URI（后端允许的回调地址，默认仅 127.0.0.1/localhost）；无浏览器环境建议直接使用默认 wait=true 自动回环登录',
          );
        }
        const state = createState();
        return ok({
          login_url: buildLoginUrl(state, GITCODE_REDIRECT_URI),
          state,
          next: '完成 GitCode 授权后，把回调地址中的 ticket/code 传给本工具（参数 ticket）。',
        });
      }

      const timeoutMs = a.timeout_s ? Number(a.timeout_s) * 1000 : LOGIN_TIMEOUT_MS;
      const r = await loginWithBrowser({ timeoutMs, openBrowser: a.open_browser !== false });
      if (!r.ok) return r;
      const saved = persist(ok(r.data));
      if (!saved.ok) return saved;
      return ok({
        ...saved.data,
        browser_opened: r.data.browser_opened,
        login_url: r.data.login_url,
      });
    },

    'hdcommunity_auth_status': async () => {
      const valid = getValidSession();
      const active = getActiveSession();
      return ok({
        auth_mode: AUTH_MODE,
        logged_in: Boolean(valid),
        expired: Boolean(active && !valid),
        session: sessionView(valid || active),
        accounts: listAccounts(),
        auth_file: authFilePath(),
      });
    },

    'hdcommunity_auth_logout': async (a) => {
      const active = getActiveSession();
      const revoke = active ? await revokeToken(active.token) : null;
      const removed = clearSession({ all: a.all === true });
      return ok({ logged_out: true, removed, revoke });
    },
  },
};