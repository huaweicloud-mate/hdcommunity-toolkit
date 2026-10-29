// Unified admin session: one login → BOTH management consoles; one logout → BOTH.
//
// The community (blog) console and the growth console are two different backends
// (hdblogservice vs HDGrowService) with their own /manage/auth/login. This helper
// fans out the SAME username/password to both and caches each token in its own
// namespace (blog: setSessionToken; grow: setGrowToken), so a single login logs into
// both and a single logout logs out of both.

import { loginAdmin, loginGrowAdmin, logoutAdmin, logoutGrowAdmin } from './http-client.mjs';
import {
  setSessionToken,
  setGrowToken,
  clearSessionToken,
  clearGrowToken,
} from '../session.mjs';
import { ok, fail, CODES } from '../errors.mjs';

/**
 * Log in to BOTH consoles with the same credentials.
 * Partial success is allowed (returns per-console status); fails only if both fail.
 * @returns {Promise<{ok:boolean, data?:{blog:object, grow:object}, error?:{code,message}}>}
 */
export async function loginBoth(sessionId, username, password) {
  const blog = { ok: false };
  const grow = { ok: false };

  const b = await loginAdmin(username, password);
  if (b.ok) {
    const d = b.data || {};
    const user = d.user || {};
    setSessionToken(sessionId, { token: d.token, username: user.username, role: user.role });
    blog.ok = true;
    blog.username = user.username;
    blog.role = user.role;
  } else {
    blog.code = b.error?.code;
    blog.message = b.error?.message;
  }

  const g = await loginGrowAdmin(username, password);
  if (g.ok) {
    const d = g.data || {};
    setGrowToken(sessionId, { token: d.token, username: d.username, role: d.role });
    grow.ok = true;
    grow.username = d.username;
    grow.role = d.role;
    grow.mustChangePassword = d.must_change_password;
  } else {
    grow.code = g.error?.code;
    grow.message = g.error?.message;
  }

  if (!blog.ok && !grow.ok) {
    return fail(
      blog.code || grow.code || CODES.UNAUTHORIZED,
      `登录失败（两个管理台均失败）：blog=${blog.message || '-'}；grow=${grow.message || '-'}`,
    );
  }
  return ok({ blog, grow });
}

/**
 * Log out of BOTH consoles (each uses its own cached token) and clear both caches.
 */
export async function logoutBoth(sessionId) {
  const b = await logoutAdmin(sessionId);
  const g = await logoutGrowAdmin(sessionId);
  clearSessionToken(sessionId);
  clearGrowToken(sessionId);
  return ok({ loggedOut: true, blog: b.ok, grow: g.ok });
}
