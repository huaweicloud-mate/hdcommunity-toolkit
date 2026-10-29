// Endpoint contract tests — assert the FINAL URL (growBase + path constant).
// Single source of truth: src/tools/grow-endpoints.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GROW_SHOW, GROW_BIZ, GROW_ADMIN } from '../src/tools/grow-endpoints.mjs';

const BASE = 'https://grow.example/api/v1/hdgrowservice';
process.env.HDGROW_BASE = process.env.HDGROW_BASE || BASE;

function fullUrl(path) {
  // 与实现一致：growBase() + path（字符串拼接，保留 context-path）
  return BASE + path;
}

test('endpoints: show paths resolve to expected URLs', () => {
  assert.equal(fullUrl(GROW_SHOW.taskList), `${BASE}/agent/show/grow/task/list`);
  assert.equal(fullUrl(GROW_SHOW.taskCategories), `${BASE}/agent/show/grow/task/categories`);
  assert.equal(fullUrl(GROW_SHOW.prizeList), `${BASE}/agent/show/grow/prize/list`);
});

test('endpoints: business paths resolve to expected URLs', () => {
  assert.equal(fullUrl(GROW_BIZ.pointsQuery), `${BASE}/agent/grow/points/query`);
  assert.equal(fullUrl(GROW_BIZ.pointsAdd), `${BASE}/agent/grow/points/add`);
  assert.equal(fullUrl(GROW_BIZ.prizeExchange), `${BASE}/agent/grow/prize/exchange`);
  assert.equal(fullUrl(GROW_BIZ.issueCoupon), `${BASE}/agent/grow/issue-coupon`);
  assert.equal(fullUrl(GROW_BIZ.taskList), `${BASE}/agent/grow/task/list`);
  assert.equal(fullUrl(GROW_BIZ.prizeList), `${BASE}/agent/grow/prize/list`);
  // 登录/注销走真实路径
  assert.equal(fullUrl(GROW_BIZ.login), `${BASE}/manage/auth/login`);
  assert.equal(fullUrl(GROW_BIZ.logout), `${BASE}/manage/auth/logout`);
});

test('endpoints: admin paths resolve to expected URLs (incl. change = /agent/admin/grow/change)', () => {
  assert.equal(fullUrl(GROW_ADMIN.change), `${BASE}/agent/admin/grow/change`);
  assert.equal(fullUrl(`${GROW_ADMIN.change}/page`), `${BASE}/agent/admin/grow/change/page`);
  assert.equal(fullUrl(GROW_ADMIN.taskPage), `${BASE}/agent/admin/grow/task/page`);
  assert.equal(fullUrl(GROW_ADMIN.prizePage), `${BASE}/agent/admin/grow/prize/page`);
  assert.equal(fullUrl(GROW_ADMIN.whitelistPage), `${BASE}/agent/admin/grow/whitelist/page`);
  assert.equal(fullUrl(GROW_ADMIN.recordPoints), `${BASE}/agent/admin/grow/points/detail/page`);
  assert.equal(fullUrl(GROW_ADMIN.recordExchange), `${BASE}/agent/admin/grow/exchange/record/page`);
  assert.equal(fullUrl(GROW_ADMIN.userPage), `${BASE}/agent/admin/grow/user/page`);
  assert.equal(fullUrl(GROW_ADMIN.stats.overview), `${BASE}/agent/admin/grow/stats/overview`);
  assert.equal(fullUrl(GROW_ADMIN.stats.task_distribution), `${BASE}/agent/admin/grow/stats/task-distribution`);
  // 动态段编码
  assert.equal(fullUrl(GROW_ADMIN.taskGet('a b')), `${BASE}/agent/admin/grow/task/a%20b`);
  assert.equal(fullUrl(GROW_ADMIN.prizeGet('p/1')), `${BASE}/agent/admin/grow/prize/p%2F1`);
});
