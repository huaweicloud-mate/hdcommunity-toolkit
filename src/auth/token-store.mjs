// Local auth-token store for GitCode login sessions.
//
// File: ~/.config/hdcommunity-toolkit/auth.json (override: HDCOMMUNITY_AUTH_FILE), mode 0600.
// Shape: { active: <accountKey>, accounts: { <accountKey>: { token, user, savedAt, expiresAt } } }
//
// Only the community session token is stored — never a GitCode password or AK/SK.

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AUTH_FILE } from '../config.mjs';

function emptyState() {
  return { active: null, accounts: {} };
}

function readState() {
  try {
    const parsed = JSON.parse(readFileSync(AUTH_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return emptyState();
    return {
      active: parsed.active || null,
      accounts: parsed.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {},
    };
  } catch {
    return emptyState();
  }
}

function writeState(state) {
  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  writeFileSync(AUTH_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(AUTH_FILE, 0o600);
  } catch {
    /* best-effort on platforms without POSIX modes */
  }
}

export function accountKey(user) {
  if (!user || typeof user !== 'object') return 'default';
  const key = user.id ?? user.uid ?? user.username ?? user.iam_id ?? user.domain_id;
  return key === undefined || key === null || key === '' ? 'default' : String(key);
}

/**
 * Persist a login session and make it active.
 * @param {{token: string, user?: object, expiresIn?: number}} session
 * @returns {{key: string, rec: object}}
 */
export function saveSession({ token, user, expiresIn }) {
  if (!token || typeof token !== 'string') throw new Error('token 不能为空');
  const state = readState();
  const key = accountKey(user);
  const now = Date.now();
  const ttl = Number(expiresIn);
  const rec = {
    token,
    user: user && typeof user === 'object' ? user : {},
    savedAt: now,
    expiresAt: Number.isFinite(ttl) && ttl > 0 ? now + ttl * 1000 : 0,
  };
  state.accounts[key] = rec;
  state.active = key;
  writeState(state);
  return { key, rec };
}

/** @returns {{key: string, token: string, user: object, expiresAt: number}|null} */
export function getActiveSession() {
  const state = readState();
  if (!state.active) return null;
  const rec = state.accounts[state.active];
  if (!rec || !rec.token) return null;
  return { key: state.active, ...rec };
}

/** Active session that has not expired (or never expires when expiresAt is 0). */
export function getValidSession() {
  const s = getActiveSession();
  if (!s) return null;
  if (s.expiresAt && Date.now() > s.expiresAt) return null;
  return s;
}

export function listAccounts() {
  const state = readState();
  return Object.entries(state.accounts).map(([key, rec]) => ({
    key,
    active: key === state.active,
    user: rec.user || {},
    savedAt: rec.savedAt || 0,
    expiresAt: rec.expiresAt || 0,
  }));
}

/** Remove the active account (or all accounts when `all` is true). */
export function clearSession({ all = false } = {}) {
  const state = readState();
  if (all) {
    writeState(emptyState());
    return 0;
  }
  if (!state.active) return 0;
  delete state.accounts[state.active];
  state.active = Object.keys(state.accounts)[0] || null;
  writeState(state);
  return 1;
}

export function authFilePath() {
  return AUTH_FILE;
}