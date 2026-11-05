// Tests for the installer CLI help flag (Issue #15).
// install --help / uninstall --help must print help, exit 0, and have no
// side effects. Uses node:test (Node >= 22 built-in), no network.
//
// Test seam: spawn the real CLI as a child process (bin/setup.cjs) — the
// public interface users actually run. Side effects (skills copy / config
// merge) are contained by pointing HOME at a fresh temp dir and asserting
// it stays empty after a --help invocation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'setup.cjs');

// Runs the CLI with HOME pointed at a fresh temp dir.
// Returns { status, stdout, home } — home is the isolated HOME path so
// callers can assert whether any side effects landed there.
function runCli(...args) {
  const home = mkdtempSync(join(tmpdir(), 'hdc-help-'));
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });
  return { status: r.status, stdout: r.stdout, home };
}

const HELP_MARKERS = ['hdcommunity-toolkit installer', 'Usage:', 'install', 'uninstall'];

function assertHelpOutput(stdout) {
  for (const marker of HELP_MARKERS) {
    assert.ok(stdout.includes(marker), `help output missing "${marker}"`);
  }
}

test('setup-cli: install --help prints help, exits 0, no install side effects', () => {
  const { status, stdout, home } = runCli('install', '--help');
  assert.equal(status, 0, `expected exit 0, got ${status}\nstdout: ${stdout}`);
  assertHelpOutput(stdout);
  // No side effects: nothing may be created under the isolated HOME.
  assert.deepEqual(readdirSync(home), [], 'install --help must not write anything to HOME');
});

test('setup-cli: install -h (short flag) prints help, exits 0', () => {
  const { status, stdout, home } = runCli('install', '-h');
  assert.equal(status, 0, `expected exit 0, got ${status}\nstdout: ${stdout}`);
  assertHelpOutput(stdout);
  assert.deepEqual(readdirSync(home), [], 'install -h must not write anything to HOME');
});

test('setup-cli: uninstall --help prints help, exits 0, no uninstall side effects', () => {
  const { status, stdout, home } = runCli('uninstall', '--help');
  assert.equal(status, 0, `expected exit 0, got ${status}\nstdout: ${stdout}`);
  assertHelpOutput(stdout);
  assert.deepEqual(readdirSync(home), [], 'uninstall --help must not write anything to HOME');
});

test('setup-cli: --help with no positional args still prints help, exits 0 (regression)', () => {
  const { status, stdout } = runCli('--help');
  assert.equal(status, 0, `expected exit 0, got ${status}\nstdout: ${stdout}`);
  assertHelpOutput(stdout);
});

test('setup-cli: status --help is not routed to install/uninstall and exits 0', () => {
  const { status, stdout, home } = runCli('status', '--help');
  assert.equal(status, 0, `expected exit 0, got ${status}\nstdout: ${stdout}`);
  assertHelpOutput(stdout);
  assert.deepEqual(readdirSync(home), [], 'status --help must not write anything to HOME');
});
