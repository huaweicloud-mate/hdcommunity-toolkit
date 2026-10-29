// Per-session admin token cache.
//
// The MCP protocol layer passes a stable `sessionId` (stdio: "stdin"; remote: per connection),
// so tokens are isolated per agent session without leaking across sessions.

const store = new Map(); // sessionId -> { token, username, role, savedAt }

/** Save an admin token for the session. */
export function setSessionToken(sessionId, { token, username, role }) {
  if (!sessionId) return;
  store.set(sessionId, { token, username: username || null, role: role || null, savedAt: Date.now() });
}

/** Get the cached admin token (or null). */
export function getSessionToken(sessionId) {
  return store.get(sessionId)?.token || null;
}

/** Get the cached session record (or null). */
export function getSession(sessionId) {
  return store.get(sessionId) || null;
}

/** Clear the session token (logout). */
export function clearSessionToken(sessionId) {
  store.delete(sessionId);
}

// ---------------------------------------------------------------------------
// Growth-center management console token cache (separate namespace to avoid
// colliding with the community admin token when both are used in one session).
// ---------------------------------------------------------------------------

const growStore = new Map(); // sessionId -> { token, username, role, savedAt, expiresAt }
const GROW_TOKEN_TTL_MS = Number(process.env.HDGROW_TOKEN_TTL_MS || 30 * 60 * 1000);

export function setGrowToken(sessionId, { token, username, role }) {
  if (!sessionId) return;
  const now = Date.now();
  growStore.set(sessionId, {
    token,
    username: username || null,
    role: role || null,
    savedAt: now,
    expiresAt: now + GROW_TOKEN_TTL_MS,
  });
}

export function getGrowToken(sessionId) {
  const s = growStore.get(sessionId);
  if (!s) return null;
  if (s.expiresAt && Date.now() > s.expiresAt) {
    growStore.delete(sessionId);
    return null;
  }
  return s.token || null;
}

export function getGrowSession(sessionId) {
  const s = growStore.get(sessionId);
  if (!s) return null;
  if (s.expiresAt && Date.now() > s.expiresAt) {
    growStore.delete(sessionId);
    return null;
  }
  return s;
}

export function clearGrowToken(sessionId) {
  growStore.delete(sessionId);
}
