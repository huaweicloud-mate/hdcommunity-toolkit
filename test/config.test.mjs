// Tests for toolkit backend base default / override behaviour (Issue #26).
//
// Test seam: the process, not the module. `config.mjs` reads HDCOMMUNITY_BASE
// once at module load, so the behaviour users actually get ("export env ->
// toolkit talks to that host, otherwise default") is only observable per
// process. Each case spawns `node` with a controlled env and prints the
// resolved BACKEND_BASE — no network, no extra dependencies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_URL = pathToFileURL(join(__dirname, '..', 'src', 'config.mjs')).href;

const DEFAULT_BASE = 'https://open-dataset.huaweicloud.com/api/v1/blogservice';
const TEST_ENV_BASE = 'https://opentest-dataset.huaweicloud.com/api/v1/blogservice';

/** Resolve BACKEND_BASE in a fresh process; `base === null` means "unset". */
function resolveBackendBase(base) {
  const env = { ...process.env };
  delete env.HDCOMMUNITY_BASE;
  if (base !== null) env.HDCOMMUNITY_BASE = base;

  const r = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const m = await import(${JSON.stringify(CONFIG_URL)}); console.log(m.BACKEND_BASE);`,
    ],
    { env, encoding: 'utf8' },
  );
  assert.equal(r.status, 0, `child process failed: ${r.stderr}`);
  return r.stdout.trim();
}

test('BACKEND_BASE: unset HDCOMMUNITY_BASE defaults to production open-dataset', () => {
  assert.equal(resolveBackendBase(null), DEFAULT_BASE);
});

test('BACKEND_BASE: empty HDCOMMUNITY_BASE falls back to production default', () => {
  assert.equal(resolveBackendBase(''), DEFAULT_BASE);
});

test('BACKEND_BASE: explicit HDCOMMUNITY_BASE still overrides (test environment)', () => {
  assert.equal(resolveBackendBase(TEST_ENV_BASE), TEST_ENV_BASE);
});

test('BACKEND_BASE: explicit HDCOMMUNITY_BASE override keeps arbitrary value verbatim', () => {
  const local = 'http://127.0.0.1:8080/api/v1/blogservice';
  assert.equal(resolveBackendBase(local), local);
});

test('BACKEND_BASE: default keeps blogservice context-path', () => {
  assert.ok(resolveBackendBase(null).endsWith('/api/v1/blogservice'));
});