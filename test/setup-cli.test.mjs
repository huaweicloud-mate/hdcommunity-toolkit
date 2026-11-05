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

// --- Multi-agent installer surface (README contract as tests) ---

const SKILLS = ['hd-blog-author', 'hd-blog-promote', 'hd-experience'];

// Deliberately restated here: if src/setup-cli.mjs drops a target, this list keeps
// the expectation independent instead of importing the constant under test.
const TARGETS = [
  'opencode',
  'codex',
  'codex-desktop',
  'codearts',
  'codearts-work',
  'workbuddy',
  'dsh',
  'hermes',
  'openclaw',
  'atomcode',
];

function makeHome() {
  return mkdtempSync(join(tmpdir(), 'hdct-home-'));
}

function runBin(args, home, extraEnv = {}) {
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    DSH_HOME: join(home, '.dsh'),
    ...extraEnv,
  };
  delete env.NODE_ENV;
  const r = spawnSync(process.execPath, [BIN, ...args], { env, encoding: 'utf8' });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}

// Skills destination each target must use (mirrors the README table).
function skillsDirOf(home, target) {
  const map = {
    opencode: join(home, '.config', 'opencode', 'skills'),
    codex: join(home, '.codex', 'skills'),
    'codex-desktop': join(home, '.codex', 'skills'),
    codearts: join(home, '.codeartsdoer', 'skills'),
    'codearts-work': join(home, '.codeartswork', 'skills'),
    workbuddy: join(home, '.workbuddy', 'skills'),
    dsh: join(home, '.dsh', 'skills'),
    hermes: join(home, '.hermes', 'skills'),
    openclaw: join(home, '.openclaw', 'skills'),
    atomcode: join(home, '.atomcode', 'skills'),
  };
  return map[target];
}

function assertSkillsInstalled(home, target) {
  const dest = skillsDirOf(home, target);
  for (const s of SKILLS) {
    assert.ok(existsSync(join(dest, s, 'SKILL.md')), `${target}: missing ${s} in ${dest}`);
  }
}

function helpTargets(out) {
  const line = out.split('\n').find((l) => l.startsWith('Targets:'));
  assert.ok(line, `help output has no Targets line:\n${out}`);
  return line.replace(/^Targets:\s*/, '').split(',').map((s) => s.trim());
}

test('help: lists every built-in target, all, and the auto-detect behaviour', () => {
  const home = makeHome();
  const { code, out } = runBin(['--help'], home);
  assert.equal(code, 0);
  assert.deepEqual(helpTargets(out), [...TARGETS, 'generic', 'all']);
  assert.match(out, /auto-detect/i, 'help must document the omitted --target behaviour');
});

test('install: without --target installs into the single detected agent', () => {
  const home = makeHome();
  mkdirSync(join(home, '.workbuddy'), { recursive: true });
  const { code, out } = runBin(['install'], home);
  assert.equal(code, 0, out);
  assert.match(out, /\[auto\] detected agent: workbuddy/);
  assertSkillsInstalled(home, 'workbuddy');
});

test('install: without --target fails and lists targets when nothing is detected', () => {
  const home = makeHome();
  const { code, err } = runBin(['install'], home);
  assert.equal(code, 1);
  assert.match(err, /no supported agent detected/i);
  for (const t of TARGETS) assert.ok(err.includes(t), `error must list ${t}`);
});

test('install: without --target refuses to guess when several agents are detected', () => {
  const home = makeHome();
  mkdirSync(join(home, '.workbuddy'), { recursive: true });
  mkdirSync(join(home, '.atomcode'), { recursive: true });
  const { code, err } = runBin(['install'], home);
  assert.equal(code, 1);
  assert.match(err, /multiple agents detected/i);
  assert.match(err, /workbuddy/);
  assert.match(err, /atomcode/);
  assert.match(err, /--target/);
});

test('install: an unknown --target fails and lists the valid values', () => {
  const home = makeHome();
  const { code, err } = runBin(['install', '--target', 'bogus'], home);
  assert.equal(code, 1);
  assert.match(err, /unknown --target: bogus/i);
  for (const t of TARGETS) assert.ok(err.includes(t), `error must list ${t}`);
});

test('install: every built-in target lands its skills in the documented directory', () => {
  for (const t of TARGETS) {
    const home = makeHome();
    const { code, out } = runBin(['install', '--target', t], home);
    assert.equal(code, 0, `${t}: ${out}`);
    assertSkillsInstalled(home, t);
  }
});

test('install --target all: covers every built-in target', () => {
  const home = makeHome();
  const { code, out } = runBin(['install', '--target', 'all'], home);
  assert.equal(code, 0, out);
  for (const t of TARGETS) assertSkillsInstalled(home, t);
});

test('status: reports every built-in target, including codex-desktop', () => {
  const home = makeHome();
  mkdirSync(join(home, '.workbuddy'), { recursive: true });
  mkdirSync(join(home, '.atomcode'), { recursive: true });
  assert.equal(runBin(['install', '--target', 'workbuddy'], home).code, 0);
  const { code, out } = runBin(['status'], home);
  assert.equal(code, 0);
  for (const t of TARGETS) {
    assert.match(out, new RegExp(`^\\s+${t}\\s`, 'm'), `status must list ${t}:\n${out}`);
  }
  assert.match(out, /^\s+workbuddy\s+installed/m);
  assert.match(out, /^\s+atomcode\s+-\s/m);
});

test('uninstall: without --target removes the single installed agent and then reports none', () => {
  const home = makeHome();
  assert.equal(runBin(['install', '--target', 'hermes'], home).code, 0);
  const first = runBin(['uninstall'], home);
  assert.equal(first.code, 0, first.err);
  assert.match(first.out, /\[auto\] detected agent: hermes/);
  assert.ok(!existsSync(join(skillsDirOf(home, 'hermes'), 'hd-blog-author')));

  const second = runBin(['uninstall'], home);
  assert.equal(second.code, 1);
  assert.match(second.err, /no installed agent detected/i);
});

test('doctor: reports node/skills/auth without leaking credentials', () => {
  const home = makeHome();
  const { code, out, err } = runBin(['doctor'], home, {
    HW_ACCESS_KEY: 'AK-SENTINEL-VALUE',
    HW_SECRET_KEY: 'SK-SENTINEL-VALUE',
  });
  assert.equal(code, 0, err);
  assert.match(out, /Node\.js/);
  assert.match(out, /skills source/);
  assert.match(out, /auth/);
  assert.ok(!out.includes('AK-SENTINEL-VALUE'));
  assert.ok(!out.includes('SK-SENTINEL-VALUE'));
  assert.ok(!err.includes('SK-SENTINEL-VALUE'));
});

test('doctor --target: fails for an agent that is not installed', () => {
  const home = makeHome();
  const { code, out } = runBin(['doctor', '--target', 'atomcode'], home);
  assert.equal(code, 1);
  assert.match(out, /atomcode/);
  assert.match(out, /0\/3|not installed/i);
});

test('doctor --target: passes once the agent is installed and its MCP entry is present', () => {
  const home = makeHome();
  assert.equal(runBin(['install', '--target', 'opencode'], home).code, 0);
  const { code, out } = runBin(['doctor', '--target', 'opencode'], home);
  assert.equal(code, 0, out);
  assert.match(out, /3\/3/);
  assert.match(out, /MCP\s+OK/);
});

test('doctor --target opencode: flags a missing MCP entry', () => {
  const home = makeHome();
  assert.equal(runBin(['install', '--target', 'opencode'], home).code, 0);
  writeFileSync(join(home, '.config', 'opencode', 'opencode.json'), '{}');
  const { code, out } = runBin(['doctor', '--target', 'opencode'], home);
  assert.equal(code, 1);
  assert.match(out, /MCP\s+MISSING/);
});

test('update: refreshes skills that were removed from an installed agent', () => {
  const home = makeHome();
  assert.equal(runBin(['install', '--target', 'atomcode'], home).code, 0);
  rmSync(join(skillsDirOf(home, 'atomcode'), 'hd-blog-author'), { recursive: true, force: true });
  const { code, out } = runBin(['update', '--target', 'atomcode'], home);
  assert.equal(code, 0, out);
  assertSkillsInstalled(home, 'atomcode');
  assert.match(out, /@latest/);
});

test('unknown command: exits 1 and prints help', () => {
  const home = makeHome();
  const { code, err } = runBin(['frobnicate'], home);
  assert.equal(code, 1);
  assert.match(err, /unknown command/i);
  assert.match(err, /Targets:/);
});
