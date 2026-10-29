// Tool result helpers and backend-error -> toolkit-error mapping.

export const CODES = {
  AUTH_MISSING: 'AUTH_MISSING',
  AUTH_FAILED: 'AUTH_FAILED',
  CONFIG_MISSING: 'CONFIG_MISSING',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NEED_LOGIN: 'NEED_LOGIN',
  FORBIDDEN: 'FORBIDDEN',
  PARAM_ERROR: 'PARAM_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_FOUND: 'NOT_FOUND',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
};

/** Successful tool result. */
export function ok(data) {
  return { ok: true, data: data === undefined ? null : data };
}

/** Failed tool result. */
export function fail(code, message) {
  return { ok: false, error: { code, message: message || code } };
}

// Backend business codes (see design §6.1)
const BACKEND = {
  UNAUTHORIZED: 10001,
  FORBIDDEN: 10002,
  ADMIN_ROLE_DENIED: 10003,
  NOT_FOUND: 10004,
  RATE_LIMITED: 30001,
  SYSTEM_ERROR: 90000,
};

/**
 * Map an HTTP status + backend ApiResponse.code to a toolkit error code.
 * @param {number} status
 * @param {number|null} apiCode
 * @returns {string}
 */
export function mapBackendError(status, apiCode) {
  if (status === 401 || apiCode === BACKEND.UNAUTHORIZED) return CODES.UNAUTHORIZED;
  if (status === 403 || apiCode === BACKEND.FORBIDDEN || apiCode === BACKEND.ADMIN_ROLE_DENIED) {
    return CODES.FORBIDDEN;
  }
  if (status === 429 || apiCode === BACKEND.RATE_LIMITED) return CODES.RATE_LIMITED;
  if (status === 404 || apiCode === BACKEND.NOT_FOUND) return CODES.NOT_FOUND;
  if (status >= 400 && status < 500) return CODES.PARAM_ERROR;
  return CODES.UPSTREAM_ERROR;
}
