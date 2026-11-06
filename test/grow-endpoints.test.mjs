// Endpoint contract tests — assert the FINAL URL (growBase + path constant).
// Single source of truth: src/tools/grow-endpoints.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GROW_SHOW } from '../src/tools/grow-endpoints.mjs';

const BASE = 'https://grow.example/api/v1/hdgrowservice';

function fullUrl(path) {
  return BASE + path;
}

test('endpoints: show paths resolve to expected URLs', () => {
  assert.equal(fullUrl(GROW_SHOW.taskList), `${BASE}/agent/show/grow/task/list`);
  assert.equal(fullUrl(GROW_SHOW.taskCategories), `${BASE}/agent/show/grow/task/categories`);
  assert.equal(fullUrl(GROW_SHOW.prizeList), `${BASE}/agent/show/grow/prize/list`);
});

test('endpoints: business paths are not part of this toolkit', async () => {
  const mod = await import('../src/tools/grow-endpoints.mjs');
  assert.equal(mod.GROW_BIZ, undefined);
});