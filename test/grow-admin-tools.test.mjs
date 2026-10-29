// Tests for the growth management-console tools (hdgrow_admin_*) — offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { callTool, TOOL_DEFINITIONS } from '../src/tools/index.mjs';

// Base is read lazily; set a value so token/auth paths (not base) are exercised.
process.env.HDGROW_BASE = process.env.HDGROW_BASE || 'https://grow.example/api/v1/hdgrowservice';

const EXPECTED = [
  'hdgrow_admin_login',
  'hdgrow_admin_logout',
  'hdgrow_admin_change_create',
  'hdgrow_admin_change_commit',
  'hdgrow_admin_change_approve',
  'hdgrow_admin_change_apply',
  'hdgrow_admin_change_revert',
  'hdgrow_admin_change_get',
  'hdgrow_admin_change_page',
  'hdgrow_admin_task_page',
  'hdgrow_admin_task_get',
  'hdgrow_admin_prize_page',
  'hdgrow_admin_prize_get',
  'hdgrow_admin_whitelist_page',
  'hdgrow_admin_record_points',
  'hdgrow_admin_record_exchange',
  'hdgrow_admin_record_issue',
  'hdgrow_admin_record_job',
  'hdgrow_admin_user_page',
  'hdgrow_admin_stats',
];

test('grow-admin: all 20 tools are registered', () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name);
  for (const n of EXPECTED) assert.ok(names.includes(n), `missing ${n}`);
});

test('grow-admin: needs login (no token) -> NEED_LOGIN', async () => {
  const r = await callTool('hdgrow_admin_change_get', { id: 'cr1' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'NEED_LOGIN');
});

test('grow-admin: stats validates kind before auth', async () => {
  const r = await callTool('hdgrow_admin_stats', { kind: 'nope' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'PARAM_ERROR');
});

test('grow-admin: stats overview without token -> NEED_LOGIN', async () => {
  const r = await callTool('hdgrow_admin_stats', { kind: 'overview' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'NEED_LOGIN');
});

test('grow-admin: logout without token is a no-op ok', async () => {
  const r = await callTool('hdgrow_admin_logout', {});
  assert.equal(r.ok, true);
});

test('grow-admin: missing HDGROW_BASE fails fast', async () => {
  const prev = process.env.HDGROW_BASE;
  delete process.env.HDGROW_BASE;
  try {
    const r = await callTool('hdgrow_admin_stats', { kind: 'overview' });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'CONFIG_MISSING');
  } finally {
    if (prev === undefined) delete process.env.HDGROW_BASE;
    else process.env.HDGROW_BASE = prev;
  }
});
