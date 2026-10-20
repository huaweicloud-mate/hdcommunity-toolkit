import { TOOL_DEFINITIONS, callTool } from './tools/index.mjs';
import { readPackageVersion } from './version.mjs';

/**
 * JSON-RPC dispatch for MCP methods.
 *
 * @param {string} method JSON-RPC method name
 * @param {object} params method params
 * @param {{ sessionId?: string }} opts session context (used by admin token cache)
 * @returns {Promise<object>} result payload
 */
export async function dispatch(method, params, opts = {}) {
  const sessionId = opts?.sessionId || 'default';

  if (method === 'initialize') {
    return {
      protocolVersion: params.protocolVersion || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: {
        name: 'hdcommunity-toolkit',
        version: readPackageVersion(),
      },
    };
  }

  if (method === 'tools/list') {
    return { tools: TOOL_DEFINITIONS };
  }

  if (method === 'tools/call') {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === params.name);
    if (!tool) {
      const err = new Error(`Unknown tool: ${params.name}`);
      err.code = -32602;
      throw err;
    }
    const missing = (tool.inputSchema?.required || []).filter(
      (key) => !params.arguments || !Object.hasOwn(params.arguments, key),
    );
    if (missing.length > 0) {
      const err = new Error(
        `Invalid params: missing required field(s) ${missing.map((k) => JSON.stringify(k)).join(', ')} for tool "${params.name}".`,
      );
      err.code = -32602;
      throw err;
    }
    const result = await callTool(params.name, params.arguments || {}, { sessionId });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: false,
    };
  }

  if (method === 'resources/list') {
    return { resources: [] };
  }

  const err = new Error(`Method not found: ${method}`);
  err.code = -32601;
  throw err;
}