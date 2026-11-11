// Tests for GitCode login (backend-initiated) — offline, against a local mock backend.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const AUTH_FILE = path.join(os.tmpdir(), `hd-auth-${process.pid}-${Date.now()}.json`);
process.env.HDCOMMUNITY_AUTH_FILE = AUTH_FILE;
process.env.HDCOMMUNITY_AUTH_MODE = 'gitcode';
process.env.HDCOMMUNITY_GITCODE_TICKET_PARAM = 'ticket';

const seen = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    seen.push({ url: req.url, headers: req.headers, body });
    const json = (code, payload) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    if (req.url === '/api/v1/blogservice/agent/auth/gitcode/exchange') {
      json(200, { code: 0, data: { token: 'TOKEN-1', user: { id: 'g1', username: 'alice' }, expires_in: 3600 } });
      return;
    }
    if (req.url === '/api/v1/blogservice/agent/auth/gitcode/remote/start') {
      json(200, {
        code: 0,
        data: {
          login_url: 'https://gitcode.com/oauth/authorize?state=st-r&mode=poll',
          state: 'st-r',
          poll_key: 'pk-r',
          expires_in: 600,
        },
      });
      return;
    }
    if (req.url === '/api/v1/blogservice/agent/auth/gitcode/poll') {
      const parsed = JSON.parse(body || '{}');
      const key = parsed.poll_key || parsed.state || '';
      if (key.includes('pending')) {
        json(200, { code: 0, data: { pending: true } });
      } else {
        json(200, { code: 0, data: { pending: false, token: 'TOKEN-P', user: { id: 'g9', username: 'bob' }, expires_in: 3600 } });
      }
      return;
    }
    if (req.url.startsWith('/api/v1/blogservice/agent/blog/list')) {
      if (req.headers.authorization === 'Bearer TOKEN-1') json(200, { code: 0, data: { list: [] } });
      else json(401, { code: 10001, message: 'unauthorized' });
      return;
    }
    json(404, { code: 10004, message: 'not found' });
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
process.env.HDCOMMUNITY_BASE = `http://127.0.0.1:${server.address().port}/api/v1/blogservice`;

const { callTool } = await import('../src/tools/index.mjs');
const { callBlog } = await import('../src/tools/http-client.mjs');

test('auth tools are registered', async () => {
  const { TOOL_DEFINITIONS } = await import('../src/tools/index.mjs');
  const names = TOOL_DEFINITIONS.map((t) => t.name);
  for (const n of ['hdcommunity_auth_login', 'hdcommunity_auth_poll', 'hdcommunity_auth_status', 'hdcommunity_auth_logout']) {
    assert.ok(names.includes(n), `missing ${n}`);
  }
});

test('login with a manual ticket exchanges and stores the session', async () => {
  const r = await callTool('hdcommunity_auth_login', { ticket: 'TICKET-123' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.logged_in, true);
  assert.equal(r.data.account, 'g1');
  assert.equal(r.data.user.username, 'alice');

  const ex = seen.find((s) => s.url.endsWith('/auth/gitcode/exchange'));
  assert.ok(ex, 'exchange endpoint was called');
  assert.equal(JSON.parse(ex.body).ticket, 'TICKET-123');
});

test('status reports the logged-in user', async () => {
  const r = await callTool('hdcommunity_auth_status', {});
  assert.equal(r.ok, true);
  assert.equal(r.data.auth_mode, 'gitcode');
  assert.equal(r.data.logged_in, true);
  assert.equal(r.data.session.user.username, 'alice');
});

test('callBlog uses the stored session token as Bearer', async () => {
  const r = await callBlog('GET', '/agent/blog/list', { query: {} });
  assert.equal(r.ok, true, JSON.stringify(r));
  const hit = seen.find((s) => s.url.startsWith('/api/v1/blogservice/agent/blog/list'));
  assert.equal(hit.headers.authorization, 'Bearer TOKEN-1');
});

test('an expired/invalid token (401) clears the session and asks to re-login', async () => {
  const store = await import('../src/auth/token-store.mjs');
  store.saveSession({ token: 'BAD-TOKEN', user: { id: 'g1', username: 'alice' }, expiresIn: 3600 });
  const r = await callBlog('GET', '/agent/blog/list', { query: {} });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'UNAUTHORIZED');
  assert.equal(store.getActiveSession(), null);
});

test('logout clears the local session', async () => {
  const store = await import('../src/auth/token-store.mjs');
  store.saveSession({ token: 'TOKEN-1', user: { id: 'g1', username: 'alice' }, expiresIn: 3600 });
  const r = await callTool('hdcommunity_auth_logout', {});
  assert.equal(r.ok, true);
  assert.equal(store.getActiveSession(), null);
});

test('loopback callback server binds a port and resolves with the ticket', async () => {
  const { startCallbackServer } = await import('../src/auth/gitcode-login.mjs');
  const cb = await startCallbackServer('state-1', 2000);
  assert.ok(cb.port > 0, 'port must be resolved after listening');
  const res = await fetch(`http://127.0.0.1:${cb.port}/callback?state=state-1&ticket=TICKET-9`);
  assert.equal(res.status, 200);
  const payload = await cb.promise;
  assert.deepEqual(payload, { ticket: 'TICKET-9' });
  cb.close();
});

test('loopback callback server rejects a mismatched state', async () => {
  const { startCallbackServer } = await import('../src/auth/gitcode-login.mjs');
  const cb = await startCallbackServer('state-1', 2000);
  const res = await fetch(`http://127.0.0.1:${cb.port}/callback?state=other&ticket=T`);
  assert.equal(res.status, 400);
  const payload = await cb.promise;
  assert.equal(payload.error, 'STATE_MISMATCH');
  cb.close();
});

test('manual mode without a redirect URI fails with guidance instead of an unusable URL', async () => {
  const r = await callTool('hdcommunity_auth_login', { wait: false });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'PARAM_ERROR');
  assert.match(r.error.message, /HDCOMMUNITY_GITCODE_REDIRECT_URI/);
});

test('remote login returns a poll-mode URL without opening a loopback callback', async () => {
  const r = await callTool('hdcommunity_auth_login', { remote: true, wait: false });
  assert.equal(r.ok, true);
  assert.equal(r.data.pending, true);
  assert.equal(r.data.poll_key, 'pk-r');
  assert.match(r.data.login_url, /mode=poll/);
  assert.ok(!r.data.login_url.includes('redirect_uri'));
});

test('remote login poll reports pending', async () => {
  const r = await callTool('hdcommunity_auth_poll', { poll_key: 'pk-pending' });
  assert.equal(r.ok, true);
  assert.equal(r.data.pending, true);
});

test('remote login poll stores the session when ready', async () => {
  const r = await callTool('hdcommunity_auth_poll', { poll_key: 'pk-ready' });
  assert.equal(r.ok, true);
  assert.equal(r.data.logged_in, true);
  assert.equal(r.data.account, 'g9');
  const store = await import('../src/auth/token-store.mjs');
  assert.equal(store.getActiveSession().token, 'TOKEN-P');
});

test('cleanup', async () => {
  server.close();
  fs.rmSync(AUTH_FILE, { force: true });
});