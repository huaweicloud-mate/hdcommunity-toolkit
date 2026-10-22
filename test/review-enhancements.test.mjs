// Issue #4 tests: B1 401 auto-relogin, B2 dry_run preview, B3 per-id receipt,
// B4 oldest-first pending order, A1 content summarize, A3 degraded blog detail.
//
// Runs a fake backend on 127.0.0.1 (no external network). env must be set before
// importing src modules (config.mjs reads env at module init) — hence dynamic import.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const PREFIX = '/api/v1/blogservice';
const VALID_TOKENS = new Set(['fresh-token', 'good-token']);
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'secret-pass';

const reviewCalls = []; // { id, action, attempt }
const reviewFailFirst = new Set([999]); // these ids fail on the first attempt only
const reviewFailAlways = new Set([12345]); // these ids always fail

const now = Date.now();
const BLOGS = [
  { id: 1, title: '最新提交的待审博客', author: 'alice', status: 1, update_time: now - 3600_000, content: '<p>短内容</p>' },
  { id: 2, title: '包含超长正文的待审博客', author: 'bob', status: 1, update_time: now - 72 * 3600_000, content: `<p>${'x'.repeat(47000)}</p>` },
  { id: 3, title: '最早的待审博客', author: 'alice', status: 1, update_time: now - 240 * 3600_000, content: '<p>老博客</p><script>alert(1)</script>' },
  { id: 4, title: '已通过的博客', author: 'carol', status: 2, update_time: now - 10 * 3600_000, content: '<p>ok</p>' },
];

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = url.pathname.slice(PREFIX.length) || '/';

  if (path === '/manage/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.username === ADMIN_USER && body.password === ADMIN_PASS) {
      return json(res, 200, { code: 0, data: { token: 'fresh-token', user: { username: ADMIN_USER, role: 'admin' } } });
    }
    return json(res, 401, { code: 10001, message: '用户名或密码错误' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!VALID_TOKENS.has(token)) {
    return json(res, 401, { code: 10001, message: '登录态已失效' });
  }

  if (path === '/agent/admin/blog/page' && req.method === 'GET') {
    const status = url.searchParams.get('status');
    let list = BLOGS;
    if (status !== null && status !== '') list = BLOGS.filter((b) => b.status === Number(status));
    return json(res, 200, { code: 0, data: { total: list.length, list: list.map((b) => ({ ...b })) } });
  }

  if (path === '/manage/blog/1/detail' && req.method === 'GET') {
    return json(res, 404, { code: 10004, message: '接口不存在（A3 未就绪）' }); // A3 not ready
  }

  if (path === '/agent/admin/blog/review' && req.method === 'POST') {
    const body = await readBody(req);
    const id = Number(body.id);
    const attempt = reviewCalls.filter((c) => c.id === id).length + 1;
    reviewCalls.push({ id, action: body.action, attempt });
    if (reviewFailAlways.has(id) || (reviewFailFirst.has(id) && attempt === 1)) {
      return json(res, 500, { code: 90000, message: '审核暂时失败' });
    }
    return json(res, 200, { code: 0, data: { id, reviewed: true } });
  }

  const recordsMatch = path.match(/^\/agent\/admin\/blog\/(\d+)\/records$/);
  if (recordsMatch && req.method === 'GET') {
    return json(res, 200, {
      code: 0,
      data: { total: 1, list: [{ id: 1, blog_id: Number(recordsMatch[1]), action: 'reject', remark: '含脚本', create_time: now - 1000_000 }] },
    });
  }

  return json(res, 404, { code: 10004, message: 'not found' });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
server.unref(); // let the test process exit once tests finish
const port = server.address().port;

process.env.HDCOMMUNITY_BASE = `http://127.0.0.1:${port}${PREFIX}`;
process.env.HDCOMMUNITY_ADMIN_USER = ADMIN_USER;
process.env.HDCOMMUNITY_ADMIN_PASS = ADMIN_PASS;

const { callTool } = await import('../src/tools/index.mjs');
const { setSessionToken, getSessionToken, clearSessionToken } = await import('../src/session.mjs');

test('B1: 401 triggers auto-relogin and the request is retried once', async () => {
  reviewCalls.length = 0;
  setSessionToken('s1', { token: 'expired-token' });
  const r = await callTool('hdcommunity_admin_blog_page', { status: 1 }, { sessionId: 's1' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(getSessionToken('s1'), 'fresh-token'); // session refreshed
  assert.equal(r.data.list.length, 3);
});

test('B1: relogin failure reports NEED_LOGIN with config guidance', async () => {
  const savedUser = process.env.HDCOMMUNITY_ADMIN_USER;
  process.env.HDCOMMUNITY_ADMIN_USER = 'wrong-user';
  clearSessionToken('s2');
  try {
    const r = await callTool('hdcommunity_admin_blog_page', {}, { sessionId: 's2' });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'NEED_LOGIN');
    assert.match(r.error.message, /HDCOMMUNITY_ADMIN_USER/);
  } finally {
    process.env.HDCOMMUNITY_ADMIN_USER = savedUser;
  }
});

test('B2: review_batch dry_run with filter previews ids + summaries, writes nothing', async () => {
  reviewCalls.length = 0;
  const r = await callTool(
    'hdcommunity_admin_blog_review_batch',
    { action: 'approve', dry_run: true, filter: { status: 1 } },
    { sessionId: 's3' }, // no session -> exercises B1 auto-login too
  );
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.dry_run, true);
  assert.equal(r.data.affected, 3);
  assert.equal(r.data.items.length, 3);
  for (const it of r.data.items) {
    assert.ok(Number.isInteger(it.id));
    assert.ok(typeof it.title === 'string');
  }
  assert.equal(reviewCalls.length, 0); // no writes happened
});

test('B2: filter by author narrows the target set', async () => {
  const r = await callTool(
    'hdcommunity_admin_blog_review_batch',
    { action: 'approve', dry_run: true, filter: { status: 1, author: 'alice' } },
    { sessionId: 's3' },
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.items.map((i) => i.id).sort(), [1, 3]);
});

test('B3: review_batch returns per-id receipt; failed item is retried once and then succeeds', async () => {
  reviewCalls.length = 0;
  const r = await callTool(
    'hdcommunity_admin_blog_review_batch',
    { ids: [1, 2, 999], action: 'approve' },
    { sessionId: 's3' },
  );
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.affected, 3);
  assert.equal(r.data.failed, 0);
  const byId = new Map(r.data.results.map((x) => [x.id, x]));
  assert.equal(byId.get(1).ok, true);
  assert.equal(byId.get(999).ok, true);
  assert.equal(byId.get(999).retried, true); // succeeded on retry
  assert.equal(reviewCalls.filter((c) => c.id === 999).length, 2); // exactly one retry
  assert.equal(reviewCalls.filter((c) => c.id === 1).length, 1);
});

test('B3: permanently failing item is reported in the per-id receipt', async () => {
  reviewCalls.length = 0;
  const r = await callTool(
    'hdcommunity_admin_blog_review_batch',
    { ids: [12345], action: 'reject', remark: '测试' },
    { sessionId: 's3' },
  );
  assert.equal(r.ok, true);
  assert.equal(r.data.affected, 0);
  assert.equal(r.data.failed, 1);
  assert.equal(r.data.results[0].ok, false);
  assert.equal(r.data.results[0].retried, true);
  assert.ok(r.data.results[0].error);
});

test('B2: neither ids nor filter is a PARAM_ERROR', async () => {
  const r = await callTool('hdcommunity_admin_blog_review_batch', { action: 'approve' }, { sessionId: 's3' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'PARAM_ERROR');
});

test('B4: pending page is sorted oldest-first with pending duration', async () => {
  const r = await callTool('hdcommunity_admin_blog_page', { status: 1 }, { sessionId: 's3' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.list.map((b) => b.id), [3, 2, 1]); // oldest -> newest
  for (const b of r.data.list) {
    assert.ok(typeof b.pending_duration === 'string' && b.pending_duration.length > 0);
    assert.ok(Number.isFinite(b.pending_since));
  }
  assert.equal(r.data.pending_order, 'oldest_first');
});

test('A1: admin blog page summarizes long content (no full content in list)', async () => {
  const r = await callTool('hdcommunity_admin_blog_page', { status: 1 }, { sessionId: 's3' });
  assert.equal(r.ok, true);
  for (const b of r.data.list) {
    assert.equal(b.content, undefined);
    assert.ok(typeof b.content_preview === 'string');
    assert.ok(Number.isFinite(b.content_length));
  }
  const long = r.data.list.find((b) => b.id === 2);
  assert.equal(long.content_length > 47000, true);
  assert.equal(long.content_preview.length <= 200, true);
});

test('A3: admin blog detail degrades gracefully when backend detail API is 404', async () => {
  const r = await callTool('hdcommunity_admin_blog_detail', { id: 1 }, { sessionId: 's3' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.degraded, true);
  assert.match(r.data.degraded_note, /A3/);
  assert.equal(typeof r.data.content, 'string'); // include_content defaults to true
  assert.ok(Array.isArray(r.data.review_records) && r.data.review_records.length === 1);
  assert.equal(r.data.risk_flags.has_script, false);
});

test('A3/A4: detail include_content=false summarizes; risk_flags detect script', async () => {
  const r = await callTool('hdcommunity_admin_blog_detail', { id: 3, include_content: false }, { sessionId: 's3' });
  assert.equal(r.ok, true);
  assert.equal(r.data.content, undefined);
  assert.ok(typeof r.data.content_preview === 'string');
  assert.equal(r.data.risk_flags.has_script, true); // blog 3 contains <script>
});

test('smoke regression: tool list includes the new detail tool', async () => {
  const names = (await import('../src/tools/index.mjs')).TOOL_DEFINITIONS.map((t) => t.name);
  assert.ok(names.includes('hdcommunity_admin_blog_detail'));
  assert.ok(names.includes('hdcommunity_admin_blog_review_batch'));
});

