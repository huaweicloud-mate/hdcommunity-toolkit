// Tests for the growth user-face tools (hdgrow_user_*) — offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { callTool, TOOL_DEFINITIONS } from '../src/tools/index.mjs';

const NAMES = [
  'hdgrow_user_info',
  'hdgrow_user_tasks',
  'hdgrow_user_prizes',
  'hdgrow_user_sign_in',
  'hdgrow_user_sign_in_status',
  'hdgrow_user_points_detail',
  'hdgrow_user_exchange_records',
  'hdgrow_user_prize_exchange',
];

test('grow-user: all 8 tools registered', () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name);
  for (const n of NAMES) assert.ok(names.includes(n), `missing ${n}`);
});

test('grow-user: prize exchange requires biz_id', async () => {
  const r = await callTool('hdgrow_user_prize_exchange', { prize_id: 'p' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'PARAM_ERROR');
});

test('grow-user: prize exchange quantity threshold -> HIGH preview', async () => {
  const r = await callTool('hdgrow_user_prize_exchange', { prize_id: 'p', biz_id: 'B1', quantity: 999 });
  assert.equal(r.ok, true);
  assert.equal(r.data.preview, true);
  assert.equal(r.data.risk_level, 'HIGH');
  assert.equal(r.data.endpoint, '/agent/user/grow/prize/exchange');
});
