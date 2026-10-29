// Tool registry: aggregates all tool groups and routes calls by name.

import { BLOG_TOOLS } from './blog-tools.mjs';
import { ADMIN_TOOLS } from './admin-tools.mjs';
import { SHOW_TOOLS } from './show-tools.mjs';
import { RISK_TOOLS } from './risk-control.mjs';
import { GROW_TOOLS } from './grow-tools.mjs';
import { GROW_ADMIN_TOOLS } from './grow-admin-tools.mjs';
import { fail, CODES } from '../errors.mjs';

// Growth management-console tools:默认开启；设 HDGROW_ADMIN_ENABLED=0 关闭
// （兼容旧名 HDGROW_DISABLE_ADMIN=1）。
const growAdminEnabled =
  process.env.HDGROW_ADMIN_ENABLED !== '0' && process.env.HDGROW_DISABLE_ADMIN !== '1';
const GROUPS = [
  BLOG_TOOLS,
  ADMIN_TOOLS,
  SHOW_TOOLS,
  RISK_TOOLS,
  GROW_TOOLS,
  ...(growAdminEnabled ? [GROW_ADMIN_TOOLS] : []),
];

export const TOOL_DEFINITIONS = GROUPS.flatMap((g) => g.definitions);

const handlers = new Map();
for (const g of GROUPS) {
  for (const [name, fn] of Object.entries(g.call)) handlers.set(name, fn);
}

/**
 * Invoke a tool by name.
 * @param {string} name
 * @param {object} args
 * @param {{ sessionId?: string }} [ctx]
 * @returns {Promise<{ok: boolean, data?: any, error?: {code: string, message: string}}>}
 */
export async function callTool(name, args, ctx = {}) {
  const fn = handlers.get(name);
  if (!fn) return fail(CODES.PARAM_ERROR, `未知工具: ${name}`);
  try {
    return await fn(args || {}, ctx);
  } catch (e) {
    return fail(CODES.UPSTREAM_ERROR, `工具执行异常: ${e.message}`);
  }
}
