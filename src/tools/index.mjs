// Tool registry: aggregates all tool groups and routes calls by name.

import { BLOG_TOOLS } from './blog-tools.mjs';
import { ADMIN_TOOLS } from './admin-tools.mjs';
import { SHOW_TOOLS } from './show-tools.mjs';
import { fail, CODES } from '../errors.mjs';

const GROUPS = [BLOG_TOOLS, ADMIN_TOOLS, SHOW_TOOLS];

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