// Tests for the growth-center tools (hdgrow_*) — guard logic for money-sensitive writes.
// Pure local: no network. Uses node:test (Node >= 22 built-in).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { callTool, TOOL_DEFINITIONS } from '../src/tools/index.mjs';

const GROW_NAMES = [
  'hdgrow_task_list',
  'hdgrow_task_categories',
  'hdgrow_prize_list',
  'hdgrow_points_query',
  'hdgrow_server_tasks',
  'hdgrow_server_prizes',
  'hdgrow_points_add',
  'hdgrow_prize_exchange',
  'hdgrow_issue_coupon',
];

test('grow: all 9 tools are registered', () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name);
  for (const n of GROW_NAMES) assert.ok(names.includes(n), `missing ${n}`);
});

test('guard: issue_coupon dry_run defaults to a preview (no write)', async () => {
  const r = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '10.00',
    biz_id: 'BIZ-1',
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.preview, true);
  assert.ok(r.data.confirm_token);
  assert.equal(r.data.risk_level, 'MID');
  assert.equal(r.data.endpoint, '/agent/grow/issue-coupon');
});

test('guard: issue_coupon over face_amount threshold is HIGH + flagged', async () => {
  const r = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '9999.00',
    biz_id: 'BIZ-2',
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.risk_level, 'HIGH');
  assert.equal(r.data.threshold_hits.length, 1);
});

test('guard: execute without confirm_token is rejected', async () => {
  const r = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '10.00',
    biz_id: 'BIZ-3',
    dry_run: false,
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'PARAM_ERROR');
});

test('guard: token bound to params — tampering after preview is rejected', async () => {
  const prev = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '10.00',
    biz_id: 'BIZ-4',
  });
  const token = prev.data.confirm_token;
  // change face_amount before executing -> token no longer matches
  const r = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '10000.00',
    biz_id: 'BIZ-4',
    dry_run: false,
    confirm_token: token,
    confirm_high_risk: true,
    reason: 'test',
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'PARAM_ERROR');
  assert.match(r.error.message, /不匹配/);
});

test('guard: high risk requires confirm_high_risk + reason', async () => {
  const prev = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '9999.00',
    biz_id: 'BIZ-5',
  });
  const r = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '9999.00',
    biz_id: 'BIZ-5',
    dry_run: false,
    confirm_token: prev.data.confirm_token,
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'PARAM_ERROR');
  assert.match(r.error.message, /高风险/);
});

test('guard: token is one-time and lets execution through the guard', async () => {
  const prev = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '10.00',
    biz_id: 'BIZ-6',
  });
  const token = prev.data.confirm_token;
  // first execution passes the guard (then fails on missing appcode / network, NOT PARAM_ERROR)
  const first = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '10.00',
    biz_id: 'BIZ-6',
    dry_run: false,
    confirm_token: token,
  });
  assert.notEqual(first.error?.code, 'PARAM_ERROR', 'guard should pass with a valid token');
  // second execution with the same token is rejected (one-time)
  const second = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '10.00',
    biz_id: 'BIZ-6',
    dry_run: false,
    confirm_token: token,
  });
  assert.equal(second.ok, false);
  assert.equal(second.error.code, 'PARAM_ERROR');
});

test('validation: face_amount format + currency', async () => {
  const bad = await callTool('hdgrow_issue_coupon', { domain_id: 'acc-1', face_amount: 'abc', biz_id: 'B1' });
  assert.equal(bad.ok, false);
  const zero = await callTool('hdgrow_issue_coupon', { domain_id: 'acc-1', face_amount: '0', biz_id: 'B2' });
  assert.equal(zero.ok, false);
  const cur = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '10.00',
    currency_code: 'USD',
    biz_id: 'B3',
  });
  assert.equal(cur.ok, false);
});

test('guard: prize_exchange quantity threshold + validation', async () => {
  const bad = await callTool('hdgrow_prize_exchange', {
    domain_id: 'acc-1',
    prize_id: 'p1',
    biz_id: 'X1',
    quantity: 0,
  });
  assert.equal(bad.ok, false);
  const high = await callTool('hdgrow_prize_exchange', {
    domain_id: 'acc-1',
    prize_id: 'p1',
    biz_id: 'X2',
    quantity: 999,
  });
  assert.equal(high.ok, true);
  assert.equal(high.data.risk_level, 'HIGH');
});

test('guard: points_add previews by default (MID)', async () => {
  const r = await callTool('hdgrow_points_add', {
    domain_id: 'acc-1',
    task_id: 'daily_login',
    completed_at: Date.now(),
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.preview, true);
  assert.equal(r.data.risk_level, 'MID');
});