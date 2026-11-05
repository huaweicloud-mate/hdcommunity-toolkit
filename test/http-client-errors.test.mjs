// Tests for http-client error message enrichment (Issue #17) — offline + local server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { unwrap } from '../src/tools/http-client.mjs';
import { CODES } from '../src/errors.mjs';

test('unwrap: non-2xx without ApiResponse code -> message contains method+path+status', () => {
  const r = unwrap({ status: 500, json: null, text: '服务器内部错误', method: 'GET', path: '/agent/user/grow/info' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, CODES.UPSTREAM_ERROR);
  assert.equal(r.error.message, 'UPSTREAM_ERROR: GET /agent/user/grow/info -> HTTP 500 服务器内部错误');
});

test('unwrap: upstream ApiResponse error -> mapped code kept, message carries context', () => {
  const r = unwrap({
    status: 200,
    json: { code: 90000, message: '服务器内部错误' },
    text: '{"code":90000,"message":"服务器内部错误"}',
    method: 'POST',
    path: '/agent/user/grow/sign',
  });
  assert.equal(r.error.code, CODES.UPSTREAM_ERROR);
  assert.equal(r.error.message, 'UPSTREAM_ERROR: POST /agent/user/grow/sign -> HTTP 200 服务器内部错误 | body: {"code":90000,"message":"服务器内部错误"}');
});

test('unwrap: transportError -> message contains method+path and failure reason', () => {
  const r = unwrap({ transportError: 'connect ECONNREFUSED 127.0.0.1:443', method: 'GET', path: '/agent/show/blog/list' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, CODES.UPSTREAM_ERROR);
  assert.equal(r.error.message, 'UPSTREAM_ERROR: GET /agent/show/blog/list -> 连接失败: connect ECONNREFUSED 127.0.0.1:443');
});

test('unwrap: long body is truncated to 200 chars and no sensitive headers echoed', () => {
  const longBody = 'x'.repeat(500) + ' AKIDEXAMPLESECRET';
  const r = unwrap({ status: 500, json: null, text: longBody, method: 'GET', path: '/p' });
  assert.ok(r.error.message.length < 400, 'message should be bounded');
  assert.ok(r.error.message.includes('x'.repeat(200)));
  assert.ok(!r.error.message.includes('AKIDEXAMPLESECRET'), 'sensitive content beyond limit must be cut');
  assert.ok(!r.error.message.includes('X-HW-AK'), 'no header names echoed');
});

test('unwrap: 2xx ApiResponse success unaffected', () => {
  const r = unwrap({ status: 200, json: { code: 0, data: { a: 1 } }, method: 'GET', path: '/x' });
  assert.deepEqual(r, { ok: true, data: { a: 1 } });
});

test('integration: callGrowShow against local 500 server -> enriched message', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: '服务器内部错误' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  process.env.HDGROW_BASE = `http://127.0.0.1:${port}/api/v1/hdgrowservice`;
  try {
    const { callGrowShow } = await import('../src/tools/http-client.mjs');
    const r = await callGrowShow('GET', '/agent/show/grow/info');
    assert.equal(r.ok, false);
    assert.equal(r.error.code, CODES.UPSTREAM_ERROR);
    assert.equal(r.error.message, 'UPSTREAM_ERROR: GET /agent/show/grow/info -> HTTP 500 服务器内部错误 | body: {"message":"服务器内部错误"}');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('integration: callGrowShow transport failure -> message contains endpoint', async () => {
  // port 1 on 127.0.0.1 is closed in CI sandboxes -> ECONNREFUSED
  process.env.HDGROW_BASE = 'http://127.0.0.1:1/api/v1/hdgrowservice';
  const { callGrowShow } = await import('../src/tools/http-client.mjs');
  const r = await callGrowShow('GET', '/agent/show/grow/tasks');
  assert.equal(r.ok, false);
  assert.equal(r.error.code, CODES.UPSTREAM_ERROR);
  assert.match(r.error.message, /^UPSTREAM_ERROR: GET \/agent\/show\/grow\/tasks -> 连接失败: /);
});
