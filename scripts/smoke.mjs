// Smoke test: exercise the MCP protocol layer in-process (no network).
// 管理台工具组默认关闭；smoke 显式开启以覆盖全量工具（GROUPS 在 import 时求值）。
process.env.HDGROW_ADMIN_ENABLED = process.env.HDGROW_ADMIN_ENABLED || '1';
const { dispatch } = await import('../src/mcp-protocol.mjs');

const init = await dispatch('initialize', { clientInfo: { name: 'smoke' } });
const list = await dispatch('tools/list', {});

const names = list.tools.map((t) => t.name);
const expect = [
  'hdcommunity_blog_create',
  'hdcommunity_blog_list',
  'hdcommunity_admin_login',
  'hdcommunity_admin_blog_review',
  'hdcommunity_show_blog_list',
];

const missing = expect.filter((n) => !names.includes(n));

console.log('server:', init.serverInfo.name, init.serverInfo.version);
console.log('tools:', names.length);
console.log('sample:', names.slice(0, 5).join(', '), '...');

// Params validation should reject missing required args.
let validationOk = false;
try {
  await dispatch('tools/call', { name: 'hdcommunity_blog_create', arguments: {} });
} catch (e) {
  validationOk = e.code === -32602;
}

if (missing.length || !validationOk) {
  console.error('SMOKE FAILED. missing:', missing, 'validationOk:', validationOk);
  process.exit(1);
}
console.log('SMOKE OK');