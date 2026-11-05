// Tests for http-client error message enrichment (Issue #17) — offline + local server.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { unwrap } from '../src/tools/http-client.mjs';
import { CODES } from '../src/errors.mjs';

test('unwrap: non-2xx without ApiResponse code -> message contains method+path+status', () => {
  const r = unwrap({ status: 500, json: null, text: '服务器内部错误', method: 'GET', path: '/agent/blog/list' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, CODES.UPSTREAM_ERROR);
  assert.equal(r.error.message, 'UPSTREAM_ERROR: GET /agent/blog/list -> HTTP 500 服务器内部错误');
});

test('unwrap: upstream ApiResponse error -> mapped code kept, message carries context', () => {
  const r = unwrap({
    status: 200,
    json: { code: 90000, message: '服务器内部错误' },
    text: '{"code":90000,"message":"服务器内部错误"}',
    method: 'POST',
    path: '/agent/blog/save',
  });
  assert.equal(r.error.code, CODES.UPSTREAM_ERROR);
  assert.equal(r.error.message, 'UPSTREAM_ERROR: POST /agent/blog/save -> HTTP 200 服务器内部错误 | body: {"code":90000,"message":"服务器内部错误"}');
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
