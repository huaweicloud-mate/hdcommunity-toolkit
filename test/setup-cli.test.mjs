// Tests for the setup CLI (bin/setup.cjs -> src/setup-cli.mjs).
// Process-level coverage: each test spawns the CLI with HOME pointed at a
// sandbox dir, then asserts on the real config files and stdout.
// Pure local: no network. Uses node:test (Node >= 22 built-in).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../src/setup-cli.mjs', import.meta.url));
const BIN = fileURLToPath(new URL('../bin/setup.cjs', import.meta.url));

const PKG_NAME = 'hdcommunity-toolkit';

// Entry shape written by mergeOpencodeConfig.
function mcpServerEntry(pkg) {
  return { type: 'local', command: ['npx', '-y', '-p', pkg, `${pkg}-mcp`], environment: {}, enabled: true };
}

function runCli(cliPath, args, home) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });
}

function sandboxHome() {
  return mkdtempSync(join(tmpdir(), 'setup-cli-test-'));
}

function readConfig(home, file = 'opencode.json') {
  return JSON.parse(readFileSync(join(home, '.config', 'opencode', file), 'utf8'));
}

function writeConfig(home, cfg, file = 'opencode.json') {
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
  writeFileSync(join(home, '.config', 'opencode', file), JSON.stringify(cfg, null, 2));
}

test('setup-cli: install -> uninstall opencode removes the hdcommunity-toolkit MCP entry', () => {
  const home = sandboxHome();
  try {
    const installed = runCli(CLI, ['install', '--target', 'opencode'], home);
    assert.equal(installed.status, 0, installed.stderr);
    const before = readConfig(home);
    assert.deepEqual(before.mcp[PKG_NAME], mcpServerEntry(PKG_NAME));

    const uninstalled = runCli(CLI, ['uninstall', '--target', 'opencode'], home);
    assert.equal(uninstalled.status, 0, uninstalled.stderr);
    const after = readConfig(home);
    assert.equal(after.mcp?.[PKG_NAME], undefined, 'toolkit MCP entry should be removed');
    assert.match(uninstalled.stdout, /\[opencode\] MCP config cleaned/);
    assert.ok(uninstalled.stdout.includes(join(home, '.config', 'opencode', 'opencode.json')));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('setup-cli: uninstall keeps user-modified entries and prints the leftover config path', () => {
  const home = sandboxHome();
  try {
    const modified = { ...mcpServerEntry(PKG_NAME), environment: { HDCOMMUNITY_BASE: 'https://custom.example' } };
    writeConfig(home, { mcp: { [PKG_NAME]: modified } }, 'opencode.jsonc');

    const r = runCli(CLI, ['uninstall', '--target', 'opencode'], home);
    assert.equal(r.status, 0, r.stderr);
    const after = readConfig(home, 'opencode.jsonc');
    assert.deepEqual(after.mcp[PKG_NAME], modified, 'user-modified entry must be kept');
    const jsoncPath = join(home, '.config', 'opencode', 'opencode.jsonc');
    assert.match(r.stdout, /leftover MCP config/);
    assert.ok(r.stdout.includes(jsoncPath), `stdout should mention ${jsoncPath}`);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('setup-cli: uninstall also cleans toolkit entries written under the mcpServers key', () => {
  const home = sandboxHome();
  try {
    writeConfig(home, {
      mcpServers: {
        [PKG_NAME]: mcpServerEntry(PKG_NAME),
        other_server: { command: 'other-mcp' },
      },
    });

    const r = runCli(CLI, ['uninstall', '--target', 'opencode'], home);
    assert.equal(r.status, 0, r.stderr);
    const after = readConfig(home);
    assert.equal(after.mcpServers[PKG_NAME], undefined);
    assert.deepEqual(after.mcpServers.other_server, { command: 'other-mcp' });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('setup-cli: install -> uninstall -> install is idempotent', () => {
  const home = sandboxHome();
  try {
    assert.equal(runCli(CLI, ['install', '--target', 'opencode'], home).status, 0);
    assert.equal(runCli(CLI, ['uninstall', '--target', 'opencode'], home).status, 0);
    assert.equal(runCli(CLI, ['install', '--target', 'opencode'], home).status, 0);
    const cfg = readConfig(home);
    assert.deepEqual(cfg.mcp[PKG_NAME], mcpServerEntry(PKG_NAME));

    // A second uninstall removes the freshly written entry again...
    const second = runCli(CLI, ['uninstall', '--target', 'opencode'], home);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(readConfig(home).mcp?.[PKG_NAME], undefined);
    assert.match(second.stdout, /\[opencode\] MCP config cleaned/);

    // ...and a third one finds nothing to clean and stays silent.
    const third = runCli(CLI, ['uninstall', '--target', 'opencode'], home);
    assert.equal(third.status, 0, third.stderr);
    assert.doesNotMatch(third.stdout, /MCP config/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('setup-cli: uninstall is silent about MCP config when no config file exists', () => {
  const home = sandboxHome();
  try {
    const r = runCli(CLI, ['uninstall', '--target', 'opencode'], home);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /MCP config/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('setup-cli: uninstall --target codex behavior is unchanged (no MCP cleanup)', () => {
  const home = sandboxHome();
  try {
    const installed = runCli(BIN, ['install', '--target', 'codex'], home);
    assert.equal(installed.status, 0, installed.stderr);
    assert.ok(existsSync(join(home, '.codex', 'skills')));

    const r = runCli(BIN, ['uninstall', '--target', 'codex'], home);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\[codex\] removed skills/);
    assert.doesNotMatch(r.stdout, /MCP config/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
