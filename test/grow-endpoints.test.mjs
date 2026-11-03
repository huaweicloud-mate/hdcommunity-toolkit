// Endpoint contract tests — assert the FINAL URL (growBase + path constant).
// Single source of truth: src/tools/grow-endpoints.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GROW_SHOW, GROW_BIZ } from '../src/tools/grow-endpoints.mjs';

const BASE = 'https://grow.example/api/v1/hdgrowservice';

function fullUrl(path) {
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
});
