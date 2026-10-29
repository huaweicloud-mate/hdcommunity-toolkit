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

const growStore = new Map(); // sessionId -> { token, username, role, savedAt }

export function setGrowToken(sessionId, { token, username, role }) {
  if (!sessionId) return;
  growStore.set(sessionId, { token, username: username || null, role: role || null, savedAt: Date.now() });
}

export function getGrowToken(sessionId) {
  return growStore.get(sessionId)?.token || null;
}

export function getGrowSession(sessionId) {
  return growStore.get(sessionId) || null;
}

export function clearGrowToken(sessionId) {
  growStore.delete(sessionId);
}