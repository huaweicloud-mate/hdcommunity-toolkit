// Tests for documentation/code consistency of the default backend base
// (Issue #26): README config table and the hd-blog-author skill must not
// advertise the test-environment host as the default, and examples must use
// a placeholder instead of a hardcoded host.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const PROD_BASE = 'https://open-dataset.huaweicloud.com/api/v1/blogservice';

test('src/config.mjs default base is the production host', () => {
  const config = read('src', 'config.mjs');
  const m = config.match(/BACKEND_BASE\s*=\s*process\.env\.HDCOMMUNITY_BASE\s*\|\|\s*'([^']+)'/);
  assert.ok(m, 'config.mjs should keep the `process.env.HDCOMMUNITY_BASE || "<default>"` shape');
  assert.equal(m[1], PROD_BASE);
});

test('README config table documents the production default and matches code', () => {
  const config = read('src', 'config.mjs');
  const codeDefault = config.match(/BACKEND_BASE\s*=\s*process\.env\.HDCOMMUNITY_BASE\s*\|\|\s*'([^']+)'/)[1];

  const readme = read('README.md');
  const row = readme.match(/^\|\s*`HDCOMMUNITY_BASE`\s*\|\s*`([^`]+)`\s*\|/m);
  assert.ok(row, 'README should document HDCOMMUNITY_BASE in the env table');
  assert.equal(row[1], codeDefault, 'README default must equal the code default');
});

test('README no longer advertises opentest-dataset as the default', () => {
  assert.ok(!read('README.md').includes('opentest-dataset'), 'README must not mention the test host');
});

test('hd-blog-author skill examples use <backend-base> placeholder, not a host', () => {
  const skill = read('skills', 'hd-blog-author', 'SKILL.md');
  assert.ok(!skill.includes('opentest-dataset'), 'skill must not mention the test host');
  assert.equal(
    (skill.match(/<backend-base>/g) || []).length >= 2,
    true,
    'both image/HTML examples should use <backend-base>',
  );
  assert.ok(
    skill.includes('HDCOMMUNITY_BASE'),
    'skill should explain that <backend-base> comes from HDCOMMUNITY_BASE / the default',
  );
});