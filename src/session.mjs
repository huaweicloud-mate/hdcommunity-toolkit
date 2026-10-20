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