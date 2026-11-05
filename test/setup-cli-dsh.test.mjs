// Tests for the setup CLI's dsh target: MCP registration via cordis.patch.yml.
// Pure local: no network. Uses node:test (Node >= 22 built-in).
//
// Seams:
//  - pure functions (renderDshPatchEntry / findDshPatchEntry / upsertDshPatch /
//    removeDshPatchEntry / dshPatchState) imported from src/dsh-patch.mjs
//  - CLI end-to-end via bin/setup.cjs with HOME / DSH_HOME / HDGROW_BASE /
//    DSH_PROFILE pointed at a temp dir

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  dshPatchState,
  findDshPatchEntry,
  removeDshPatchEntry,
  renderDshPatchEntry,
  upsertDshPatch,
} from '../src/dsh-patch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');
const BIN = join(PKG_ROOT, 'bin', 'setup.cjs');

// ---------------------------------------------------------------------------
// Pure-function seam
// ---------------------------------------------------------------------------

describe('dsh patch entry rendering', () => {
  test('renders the insert: key syntax (not a bare - id: entry)', () => {
    const text = renderDshPatchEntry('https://grow.example/api/v1/hdgrowservice');
    assert.match(text, /^- insert:\s*$/m);
    assert.match(text, /- id: mcp-hdcommunity/m);
    // insert: must precede the id line
    assert.ok(text.indexOf('- insert:') < text.indexOf('- id: mcp-hdcommunity'));
  });

  test('renders the full managed entry (name/config/env)', () => {
    const text = renderDshPatchEntry('https://grow.example/api/v1/hdgrowservice');
    assert.match(text, /name: '@deepseek-ai\/dsh-mcp-client'/);
    assert.match(text, /serverName: hdcommunity/);
    assert.match(text, /transport: stdio/);
    assert.match(text, /command: npx/);
    assert.match(text, /args: \['-y', '-p', 'hdcommunity-toolkit', 'hdcommunity-toolkit-mcp'\]/);
    assert.match(text, /HDGROW_BASE: 'https:\/\/grow\.example\/api\/v1\/hdgrowservice'/);
    // managed comment marker so uninstall can remove exactly this block
    assert.match(text, /# hdcommunity-toolkit: managed MCP patch entry \(id: mcp-hdcommunity\)/);
  });

  test('single-quotes and escapes YAML-special characters in HDGROW_BASE', () => {
    const text = renderDshPatchEntry("https://grow.example/api?x=1&y='2'");
    // inner ' must be escaped as '' inside the single-quoted scalar
    assert.match(text, /^ {10}HDGROW_BASE: 'https:\/\/grow\.example\/api\?x=1&y=''2'''$/m);
  });
});

describe('dsh patch entry idempotence helpers', () => {
  const entry = () => renderDshPatchEntry('https://grow.example/api');

  test('findDshPatchEntry: detects the managed entry', () => {
    assert.equal(findDshPatchEntry(entry()), true);
    assert.equal(findDshPatchEntry('# nothing here\n'), false);
  });

  test('findDshPatchEntry: detects a quoted id (single or double quotes)', () => {
    assert.equal(findDshPatchEntry("- insert:\n    - id: 'mcp-hdcommunity'\n"), true);
    assert.equal(findDshPatchEntry('- insert:\n    - id: "mcp-hdcommunity"\n'), true);
    assert.equal(findDshPatchEntry('- insert:\n    - id: "mcp-other"\n'), false);
  });

  test('findDshPatchEntry: detects a hand-written entry with the same id', () => {
    const manual = [
      '- insert:',
      '    - id: mcp-hdcommunity',
      "      name: '@deepseek-ai/dsh-mcp-client'",
      '      config:',
      '        transport: stdio',
      '',
    ].join('\n');
    assert.equal(findDshPatchEntry(manual), true);
  });

  test('upsertDshPatch: creates the patch file (and parent dirs) when missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'profiles', 'web', 'cordis.patch.yml');
      const r = upsertDshPatch(file, 'https://grow.example/api');
      assert.equal(r.action, 'created');
      const text = readFileSync(file, 'utf8');
      assert.equal(findDshPatchEntry(text), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('upsertDshPatch: appends to an existing user patch without duplicating', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      writeFileSync(file, '# my own patch\n- insert:\n    - id: something-else\n      name: x\n');
      const r1 = upsertDshPatch(file, 'https://grow.example/api');
      assert.equal(r1.action, 'updated');
      const text1 = readFileSync(file, 'utf8');
      assert.equal(text1.startsWith('# my own patch\n'), true, 'existing content must be preserved');
      assert.equal(findDshPatchEntry(text1), true);
      // second install: idempotent, no duplicate entry
      const r2 = upsertDshPatch(file, 'https://grow.example/api');
      assert.equal(r2.action, 'skipped');
      const text2 = readFileSync(file, 'utf8');
      assert.equal(text2, text1, 'skipped run must not rewrite the file');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('upsertDshPatch: a hand-written same-id entry without our comment is left untouched', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      writeFileSync(file, '- insert:\n    - id: mcp-hdcommunity\n      name: manual\n');
      const before = readFileSync(file, 'utf8');
      const r = upsertDshPatch(file, 'https://new.example/api');
      assert.equal(r.action, 'skipped');
      assert.equal(readFileSync(file, 'utf8'), before, 'hand-written registration must be left untouched');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('upsertDshPatch: refreshes the managed block when HDGROW_BASE changes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      writeFileSync(file, '# my own patch\n');
      upsertDshPatch(file, 'https://old.example/api');
      const r = upsertDshPatch(file, 'https://new.example/api');
      assert.equal(r.action, 'updated');
      const text = readFileSync(file, 'utf8');
      assert.match(text, /HDGROW_BASE: 'https:\/\/new\.example\/api'/);
      assert.doesNotMatch(text, /old\.example/, 'stale HDGROW_BASE must be replaced');
      assert.equal(text.split('- id: mcp-hdcommunity').length - 1, 1, 'still exactly one entry');
      assert.equal(text.startsWith('# my own patch\n'), true, 'user content must survive');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('upsertDshPatch: refreshes our managed block without touching a hand-written same-id entry', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      upsertDshPatch(file, 'https://old.example/api');
      // user adds their own same-id entry below ours
      const withManual =
        readFileSync(file, 'utf8') +
        '- insert:\n    - id: mcp-hdcommunity\n      name: manual\n';
      writeFileSync(file, withManual);
      const r = upsertDshPatch(file, 'https://new.example/api');
      assert.equal(r.action, 'updated');
      const text = readFileSync(file, 'utf8');
      assert.match(text, /HDGROW_BASE: 'https:\/\/new\.example\/api'/, 'managed block refreshed in place');
      assert.match(text, /name: manual/, 'hand-written entry must survive');
      assert.equal(
        text.split('# hdcommunity-toolkit: managed MCP patch entry').length - 1,
        1,
        'managed block must not be duplicated',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('upsertDshPatch: refuses a non-sequence file instead of corrupting it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      writeFileSync(file, 'model: gpt\nlogLevel: debug\n');
      const before = readFileSync(file, 'utf8');
      const r = upsertDshPatch(file, 'https://grow.example/api');
      assert.equal(r.action, 'invalid');
      assert.equal(readFileSync(file, 'utf8'), before, 'file must stay untouched');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('removeDshPatchEntry: a stale comment whose entry the user replaced keeps the user entry', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      const comment = renderDshPatchEntry('https://grow.example/api').split('\n')[0];
      // the managed entry was deleted by the user; the leftover comment is
      // immediately followed by the user's own top-level entry
      writeFileSync(file, `${comment}\n- insert:\n    - id: my-own-entry\n      name: mine\n`);
      const r = removeDshPatchEntry(file);
      assert.equal(r.removed, true);
      const text = readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /managed MCP patch entry/, 'stale managed comment must be gone');
      assert.match(text, /- id: my-own-entry/, 'following user entry must survive');
      assert.match(text, /name: mine/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('upsertDshPatch: refuses a mapping document behind a leading --- instead of corrupting it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      writeFileSync(file, '---\nmodel: gpt\nlogLevel: debug\n');
      const before = readFileSync(file, 'utf8');
      const r = upsertDshPatch(file, 'https://grow.example/api');
      assert.equal(r.action, 'invalid');
      assert.equal(readFileSync(file, 'utf8'), before, 'file must stay untouched');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('upsertDshPatch: accepts a sequence document behind a leading ---', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      writeFileSync(file, '---\n- insert:\n    - id: something-else\n      name: x\n');
      const r = upsertDshPatch(file, 'https://grow.example/api');
      assert.equal(r.action, 'updated');
      assert.equal(findDshPatchEntry(readFileSync(file, 'utf8')), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('upsertDshPatch: refuses to append into a trailing mapping document after ---', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      writeFileSync(file, '- insert:\n    - id: something-else\n      name: x\n---\nmodel: gpt\n');
      const before = readFileSync(file, 'utf8');
      const r = upsertDshPatch(file, 'https://grow.example/api');
      assert.equal(r.action, 'invalid');
      assert.equal(readFileSync(file, 'utf8'), before, 'file must stay untouched');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('removeDshPatchEntry: removes the managed block and stays idempotent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      writeFileSync(file, '# my own patch\n');
      upsertDshPatch(file, 'https://grow.example/api');
      const r1 = removeDshPatchEntry(file);
      assert.equal(r1.removed, true);
      const text = readFileSync(file, 'utf8');
      assert.equal(findDshPatchEntry(text), false);
      assert.equal(text.startsWith('# my own patch\n'), true, 'user content must survive');
      const r2 = removeDshPatchEntry(file);
      assert.equal(r2.removed, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('removeDshPatchEntry: keeps a hand-written same-id entry (removes managed block only)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      upsertDshPatch(file, 'https://grow.example/api');
      writeFileSync(
        file,
        readFileSync(file, 'utf8') + '- insert:\n    - id: mcp-hdcommunity\n      name: manual\n',
      );
      const r = removeDshPatchEntry(file);
      assert.equal(r.removed, true);
      const text = readFileSync(file, 'utf8');
      assert.match(text, /name: manual/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('removeDshPatchEntry: missing file is a no-op', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const r = removeDshPatchEntry(join(dir, 'nope', 'cordis.patch.yml'));
      assert.equal(r.removed, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('removeDshPatchEntry: no blank line between blocks still keeps the following user entry', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      upsertDshPatch(file, 'https://grow.example/api');
      // user appends their own entry directly, without the separating blank line
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replace(/\n+$/, '\n') +
          '- insert:\n    - id: my-own-entry\n      name: mine\n',
      );
      const r = removeDshPatchEntry(file);
      assert.equal(r.removed, true);
      const text = readFileSync(file, 'utf8');
      assert.equal(findDshPatchEntry(text), false, 'managed entry must be gone');
      assert.match(text, /- id: my-own-entry/, 'following user entry must survive');
      assert.match(text, /name: mine/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('dshPatchState: MISSING / OK / INVALID for the doctor check', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-'));
    try {
      const file = join(dir, 'cordis.patch.yml');
      assert.equal(dshPatchState(file), 'MISSING', 'absent file is MISSING');
      upsertDshPatch(file, 'https://grow.example/api');
      assert.equal(dshPatchState(file), 'OK');
      writeFileSync(file, 'model: gpt\n');
      assert.equal(dshPatchState(file), 'INVALID', 'mapping document is not a usable patch');
      writeFileSync(file, '- insert:\n    - id: something-else\n      name: x\n');
      assert.equal(dshPatchState(file), 'MISSING', 'sequence without our entry is MISSING');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// CLI end-to-end seam
// ---------------------------------------------------------------------------

describe('setup CLI dsh target (end-to-end)', () => {
  let env;

  beforeEach(() => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-cli-'));
    env = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      DSH_HOME: home,
      HDGROW_BASE: 'https://grow.example/api/v1/hdgrowservice',
      DSH_PROFILE: 'web',
    };
    delete env.NODE_ENV;
  });

  afterEach(() => {
    if (env?.HOME) rmSync(env.HOME, { recursive: true, force: true });
  });

  const patchFile = () => join(env.DSH_HOME, 'profiles', env.DSH_PROFILE || 'web', 'cordis.patch.yml');
  const run = (args) => spawnSync(process.execPath, [BIN, ...args], { env, encoding: 'utf8' });

  test('install --target dsh writes the insert: entry into the web profile patch', () => {
    const r = run(['install', '--target', 'dsh']);
    assert.equal(r.status, 0, r.stderr);
    const text = readFileSync(patchFile(), 'utf8');
    assert.equal(findDshPatchEntry(text), true);
    assert.match(text, /^- insert:\s*$/m);
    assert.match(text, /HDGROW_BASE: 'https:\/\/grow\.example\/api\/v1\/hdgrowservice'/);
    assert.match(r.stdout, new RegExp(`\\[dsh\\] MCP patch created -> ${patchFile()}`));
  });

  test('install --target dsh respects DSH_PROFILE', () => {
    env.DSH_PROFILE = 'agent';
    const r = run(['install', '--target', 'dsh']);
    assert.equal(r.status, 0, r.stderr);
    const text = readFileSync(join(env.DSH_HOME, 'profiles', 'agent', 'cordis.patch.yml'), 'utf8');
    assert.equal(findDshPatchEntry(text), true);
  });

  test('HDGROW_BASE missing: CONFIG_MISSING fail-fast, no config written', () => {
    delete env.HDGROW_BASE;
    const r = run(['install', '--target', 'dsh']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /CONFIG_MISSING/);
    assert.match(r.stderr, /HDGROW_BASE/);
    assert.equal(existsSync(patchFile()), false, 'no patch file may be created on failure');
    assert.equal(existsSync(join(env.DSH_HOME, 'skills')), false, 'no skills may be written on failure');
  });

  test('uninstall --target dsh removes the entry; repeated cycles leave no duplicates/residue', () => {
    assert.equal(run(['install', '--target', 'dsh']).status, 0);
    // idempotent double install
    assert.equal(run(['install', '--target', 'dsh']).status, 0);
    assert.equal(readFileSync(patchFile(), 'utf8').split('- id: mcp-hdcommunity').length - 1, 1);

    const r = run(['uninstall', '--target', 'dsh']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(findDshPatchEntry(readFileSync(patchFile(), 'utf8')), false);

    // reinstall after uninstall: exactly one entry again
    assert.equal(run(['install', '--target', 'dsh']).status, 0);
    const text = readFileSync(patchFile(), 'utf8');
    assert.equal(text.split('- id: mcp-hdcommunity').length - 1, 1);

    // uninstall again (idempotent) then uninstall with no file at all
    assert.equal(run(['uninstall', '--target', 'dsh']).status, 0);
    rmSync(patchFile(), { force: true });
    assert.equal(run(['uninstall', '--target', 'dsh']).status, 0);
  });

  test('uninstall --target dsh preserves user content around the managed block', () => {
    assert.equal(run(['install', '--target', 'dsh']).status, 0);
    writeFileSync(patchFile(), '# keep me\n' + readFileSync(patchFile(), 'utf8'));
    assert.equal(run(['uninstall', '--target', 'dsh']).status, 0);
    const text = readFileSync(patchFile(), 'utf8');
    assert.match(text, /# keep me/);
    assert.equal(findDshPatchEntry(text), false);
  });

  test('install --target dsh still writes skills (patch does not replace skills)', () => {
    const r = run(['install', '--target', 'dsh']);
    assert.equal(r.status, 0, r.stderr);
    const skillsDir = join(env.DSH_HOME, 'skills');
    assert.equal(existsSync(skillsDir), true);
    assert.ok(readFileSync(join(skillsDir, 'hd-blog-author', 'SKILL.md'), 'utf8').length > 0);
  });

  test('install --target all registers the dsh patch only when HDGROW_BASE is set', () => {
    const r = run(['install', '--target', 'all']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(findDshPatchEntry(readFileSync(patchFile(), 'utf8')), true);

    const home2 = mkdtempSync(join(tmpdir(), 'dsh-cli-all-'));
    try {
      const env2 = { ...env, HOME: home2, USERPROFILE: home2, DSH_HOME: home2 };
      delete env2.HDGROW_BASE;
      const r2 = spawnSync(process.execPath, [BIN, 'install', '--target', 'all'], { env: env2, encoding: 'utf8' });
      assert.equal(r2.status, 1, 'missing HDGROW_BASE must still fail the dsh part of `all`');
      assert.match(r2.stderr, /CONFIG_MISSING/);
      // other agents are unaffected
      assert.equal(existsSync(join(home2, '.hermes', 'skills', 'hd-blog-author')), true);
      assert.equal(existsSync(join(home2, 'profiles', 'web', 'cordis.patch.yml')), false);
    } finally {
      rmSync(home2, { recursive: true, force: true });
    }
  });

  test('update --target dsh refreshes HDGROW_BASE in the managed block', () => {
    assert.equal(run(['install', '--target', 'dsh']).status, 0);
    env.HDGROW_BASE = 'https://new-grow.example/api';
    const r = run(['update', '--target', 'dsh']);
    assert.equal(r.status, 0, r.stderr);
    const text = readFileSync(patchFile(), 'utf8');
    assert.match(text, /HDGROW_BASE: 'https:\/\/new-grow\.example\/api'/);
    assert.equal(text.split('- id: mcp-hdcommunity').length - 1, 1);
  });

  test('doctor --target dsh reports the managed MCP entry and flags its removal', () => {
    assert.equal(run(['install', '--target', 'dsh']).status, 0);
    const ok = run(['doctor', '--target', 'dsh']);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /MCP\s+OK/);

    // user deletes the entry (file stays a sequence) -> doctor must flag it
    writeFileSync(patchFile(), '- insert:\n    - id: something-else\n      name: x\n');
    const missing = run(['doctor', '--target', 'dsh']);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /MCP\s+MISSING/);
  });
});