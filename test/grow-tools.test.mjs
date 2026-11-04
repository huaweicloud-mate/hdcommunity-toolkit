// Tests for the growth-center tools (hdgrow_*) — display face (public read-only) only.
// Pure local: no network. Uses node:test (Node >= 22 built-in).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { callTool, TOOL_DEFINITIONS } from '../src/tools/index.mjs';
import { growBase } from '../src/config.mjs';

const DEFAULT_GROW_BASE = 'https://opctest-dataset.developer.huaweicloud.com/api/v1/hdgrowservice';

const GROW_NAMES = ['hdgrow_task_list', 'hdgrow_task_categories', 'hdgrow_prize_list'];

const REMOVED_BUSINESS_NAMES = [
  'hdgrow_points_query',
  'hdgrow_server_tasks',
  'hdgrow_server_prizes',
  'hdgrow_points_add',
  'hdgrow_prize_exchange',
  'hdgrow_issue_coupon',
];

test('grow: display-face tools are registered', () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name);
  for (const n of GROW_NAMES) assert.ok(names.includes(n), `missing ${n}`);
});

test('grow: operator business tools are no longer exposed', () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name);
  for (const n of REMOVED_BUSINESS_NAMES) assert.ok(!names.includes(n), `unexpected ${n}`);
});

test('grow: removed business tools are unknown to the router', async () => {
  const r = await callTool('hdgrow_issue_coupon', {
    domain_id: 'acc-1',
    face_amount: '10.00',
    biz_id: 'BIZ-1',
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'PARAM_ERROR');
  assert.match(r.error.message, /未知工具/);
});

test('grow: HDGROW_BASE defaults to the test gateway when unset', () => {
  const prev = process.env.HDGROW_BASE;
  delete process.env.HDGROW_BASE;
  try {
    assert.equal(growBase(), DEFAULT_GROW_BASE);
  } finally {
    if (prev === undefined) delete process.env.HDGROW_BASE;
    else process.env.HDGROW_BASE = prev;
  }
});

test('grow: HDGROW_BASE env overrides the default', () => {
  const prev = process.env.HDGROW_BASE;
  process.env.HDGROW_BASE = 'https://prod.example/api/v1/hdgrowservice';
  try {
    assert.equal(growBase(), 'https://prod.example/api/v1/hdgrowservice');
  } finally {
    if (prev === undefined) delete process.env.HDGROW_BASE;
    else process.env.HDGROW_BASE = prev;
  }
});