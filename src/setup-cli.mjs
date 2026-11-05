// hdcommunity-toolkit installer CLI.
// Commands: install | uninstall | update | status | doctor | help
// Targets:  opencode | codex | codex-desktop | codearts | codearts-work | workbuddy |
//           dsh | hermes | openclaw | atomcode | generic | all

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPackageVersion } from './version.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');
const SKILLS_SRC = join(PKG_ROOT, 'skills');
const PKG_NAME = 'hdcommunity-toolkit';
const MCP_BIN = 'hdcommunity-toolkit-mcp';
const NODE_MIN_MAJOR = 22;

// Single source of truth for the built-in agents. `--help`, `status`, `all`,
// auto-detection and the README table are all derived from this list, so a
// target can no longer be added in one place and forgotten in another
// (that is how `codex-desktop` used to be missing from `status` / `all`).
const SUPPORTED_TARGETS = [
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
// Accepted `--target` values that are not agents: `all` installs every built-in
// agent, `generic` only prints the portable MCP snippet.
const NON_AGENT_TARGETS = ['generic', 'all'];
const VALID_TARGETS = [...SUPPORTED_TARGETS, ...NON_AGENT_TARGETS];

const home = homedir();

function skillsDirFor(target) {
  switch (target) {
    case 'opencode':
      return join(home, '.config', 'opencode', 'skills');
    case 'codex':
    case 'codex-desktop':
      return join(home, '.codex', 'skills');
    case 'codearts':
      return join(home, '.codeartsdoer', 'skills');
    case 'codearts-work':
      return join(home, '.codeartswork', 'skills');
    case 'workbuddy':
      return join(home, '.workbuddy', 'skills');
    case 'dsh':
      return join(process.env.DSH_HOME || join(home, '.dsh'), 'skills');
    case 'hermes':
      return join(home, '.hermes', 'skills');
    case 'openclaw':
      return join(home, '.openclaw', 'skills');
    case 'atomcode':
      return join(home, '.atomcode', 'skills');
    default:
      return join(home, `.${target}`, 'skills');
  }
}

// The agent's own config/skill root — what auto-detection probes. It is always the
// parent of that agent's skills dir, so detection cannot drift from installation.
// (codex and codex-desktop share ~/.codex, so both are reported when it exists.)
function agentRootFor(target) {
  return dirname(skillsDirFor(target));
}

function listSkills() {
  if (!existsSync(SKILLS_SRC)) return [];
  return readdirSync(SKILLS_SRC).filter((n) => existsSync(join(SKILLS_SRC, n, 'SKILL.md')));
}

function copySkills(destDir) {
  const skills = listSkills();
  mkdirSync(destDir, { recursive: true });
  for (const s of skills) {
    cpSync(join(SKILLS_SRC, s), join(destDir, s), { recursive: true });
  }
  return skills;
}

function mcpServerEntryFor(pkg) {
  return { type: 'local', command: ['npx', '-y', '-p', pkg, `${pkg}-mcp`], environment: {}, enabled: true };
}

function opencodeConfigCandidates() {
  return [
    join(home, '.config', 'opencode', 'opencode.json'),
    join(home, '.config', 'opencode', 'opencode.jsonc'),
  ];
}

function readOpencodeConfig() {
  const candidates = opencodeConfigCandidates();
  const file = candidates.find((f) => existsSync(f));
  if (!file) return { file: candidates[0], exists: false };
  try {
    return { file, cfg: JSON.parse(readFileSync(file, 'utf8')), exists: true };
  } catch {
    return { file, exists: true, parseError: true };
  }
}

function mergeOpencodeConfig() {
  const r = readOpencodeConfig();
  if (r.parseError) return { merged: false, file: r.file, reason: 'existing config not valid JSON' };
  const cfg = r.cfg || {};
  cfg.mcp = cfg.mcp || {};
  cfg.mcp[PKG_NAME] = mcpServerEntryFor(PKG_NAME);
  mkdirSync(dirname(r.file), { recursive: true });
  writeFileSync(r.file, JSON.stringify(cfg, null, 2));
  return { merged: true, file: r.file };
}

// Removal is symmetric with mergeOpencodeConfig: only entries exactly as
// written by this installer are deleted. Entries modified by the user
// are kept and reported instead of being overwritten.
const CLEANED_TOOLKIT_PKGS = ['hdcommunity-toolkit'];

function sameMcpEntry(a, b) {
  for (const v of [a, b]) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function pruneOpencodeConfig() {
  const r = readOpencodeConfig();
  if (!r.exists) return null;
  const cleaned = [];
  const kept = [];
  if (!r.parseError) {
    for (const key of ['mcp', 'mcpServers']) {
      const bucket = r.cfg[key];
      if (typeof bucket !== 'object' || bucket === null || Array.isArray(bucket)) continue;
      for (const pkg of CLEANED_TOOLKIT_PKGS) {
        if (!(pkg in bucket)) continue;
        if (sameMcpEntry(bucket[pkg], mcpServerEntryFor(pkg))) {
          delete bucket[pkg];
          cleaned.push(`${key}.${pkg}`);
        } else {
          kept.push(`${key}.${pkg}`);
        }
      }
      if (Object.keys(bucket).length === 0) delete r.cfg[key];
    }
  }
  if (cleaned.length > 0) {
    mkdirSync(dirname(r.file), { recursive: true });
    writeFileSync(r.file, JSON.stringify(r.cfg, null, 2));
  }
  return { file: r.file, cleaned, kept, unreadable: Boolean(r.parseError) };
}

function printOpencodeCleanup(r) {
  if (!r) return;
  if (r.unreadable) {
    console.log(`[opencode] could not parse ${r.file}; check leftover MCP config manually`);
    return;
  }
  if (r.cleaned.length > 0) {
    console.log(`[opencode] MCP config cleaned -> ${r.file} (removed ${r.cleaned.join(', ')})`);
  }
  if (r.kept.length > 0) {
    console.log(`[opencode] leftover MCP config (modified after install, kept): ${r.kept.join(', ')} in ${r.file}`);
  }
}

/** Whether the OpenCode config already registers this package (doctor check). */
function opencodeMcpState() {
  const file = opencodeConfigCandidates().find((f) => existsSync(f));
  if (!file) return 'MISSING';
  try {
    const cfg = JSON.parse(readFileSync(file, 'utf8'));
    return cfg.mcp && cfg.mcp[PKG_NAME] ? 'OK' : 'MISSING';
  } catch {
    return 'INVALID';
  }
}

function printGenericSnippet() {
  const snippet = {
    mcpServers: {
      [PKG_NAME]: { command: 'npx', args: ['-y', '-p', PKG_NAME, MCP_BIN] },
    },
  };
  console.log('Add this MCP server to your agent config:\n');
  console.log(JSON.stringify(snippet, null, 2));
}

/** Skills present for a target — used by `status`, `doctor` and uninstall detection. */
function installedSkillCount(target) {
  const dest = skillsDirFor(target);
  if (!existsSync(dest)) return 0;
  return listSkills().filter((s) => existsSync(join(dest, s))).length;
}

function install(target) {
  if (target === 'all') {
    for (const t of SUPPORTED_TARGETS) install(t);
    return;
  }
  const dest = skillsDirFor(target);
  const skills = copySkills(dest);
  console.log(`[${target}] skills -> ${dest} (${skills.length} skills)`);
  if (target === 'opencode') {
    const r = mergeOpencodeConfig();
    if (r.merged) console.log(`[${target}] MCP config -> ${r.file}`);
    else console.log(`[${target}] could not merge MCP config (${r.reason}); add manually:`), printGenericSnippet();
  } else {
    printGenericSnippet();
  }
}

function uninstall(target) {
  if (target === 'all') {
    for (const t of SUPPORTED_TARGETS) {
      if (installedSkillCount(t) > 0) uninstall(t);
    }
    return;
  }
  const dest = skillsDirFor(target);
  for (const s of listSkills()) {
    const p = join(dest, s);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
  console.log(`[${target}] removed skills from ${dest}`);
  if (target === 'opencode') {
    printOpencodeCleanup(pruneOpencodeConfig());
  }
}

function status() {
  console.log(`package: ${PKG_NAME}@${readPackageVersion()}`);
  console.log(`skills source: ${SKILLS_SRC} (${listSkills().length} skills)`);
  for (const t of SUPPORTED_TARGETS) {
    const dest = skillsDirFor(t);
    const present = installedSkillCount(t) > 0;
    console.log(`  ${t.padEnd(14)} ${present ? 'installed' : '-'}  ${dest}`);
  }
}

/**
 * Which agents look present on this machine.
 * `install` probes the agent's config root (the agent is there, ready to receive
 * skills); `uninstall` probes for skills this package previously copied, so a
 * never-installed agent is never targeted. Filesystem only — no external
 * commands, no guessing binary names.
 */
function detectTargets(mode) {
  if (mode === 'uninstall') return SUPPORTED_TARGETS.filter((t) => installedSkillCount(t) > 0);
  return SUPPORTED_TARGETS.filter((t) => existsSync(agentRootFor(t)));
}

/**
 * Resolve the target for install/uninstall/update/doctor.
 * Returns the target name, or null after setting a non-zero exit code (the
 * caller must not act on null) when the request cannot be resolved safely.
 */
function resolveTarget(args, mode) {
  const requested = args.target;
  if (requested !== undefined) {
    const value = String(requested).toLowerCase();
    if (VALID_TARGETS.includes(value)) return value;
    console.error(`Unknown --target: ${requested}`);
    console.error(`Valid targets: ${VALID_TARGETS.join(', ')}`);
    process.exitCode = 1;
    return null;
  }

  const detected = detectTargets(mode);
  if (detected.length === 1) {
    console.log(`[auto] detected agent: ${detected[0]}`);
    return detected[0];
  }
  if (detected.length === 0) {
    const what = mode === 'uninstall' ? 'No installed agent detected' : 'No supported agent detected';
    console.error(`${what}: refusing to guess.`);
    console.error(`${mode === 'uninstall' ? 'Uninstall' : 'Install'} explicitly with --target: ${VALID_TARGETS.join(', ')}`);
    process.exitCode = 1;
    return null;
  }
  console.error(`Multiple agents detected: ${detected.join(', ')} — refusing to guess.`);
  if (detected.includes('codex') && detected.includes('codex-desktop')) {
    console.error('Note: codex and codex-desktop share ~/.codex, so both are reported.');
    console.error('Pick one: --target codex (CLI) or --target codex-desktop (Desktop).');
  }
  console.error(`Re-run with an explicit --target: ${VALID_TARGETS.join(', ')}`);
  process.exitCode = 1;
  return null;
}

/** Whether AK/SK are configured — reports readiness only, never the values. */
function authState() {
  if (process.env.HW_ACCESS_KEY && process.env.HW_SECRET_KEY) return 'AK/SK from environment OK';
  if (existsSync(join(home, '.config', 'huaweicloud', 'credentials.json'))) return 'credentials file OK';
  if (existsSync(join(home, '.hcloud', 'config.json'))) return 'hcloud config OK';
  return 'not configured (set HW_ACCESS_KEY/HW_SECRET_KEY)';
}

/**
 * Self-check. With no target, reports every installed agent and only fails on
 * environment problems; with a target, that agent must be fully installed.
 */
function doctor(target) {
  const skills = listSkills();
  let ok = true;
  console.log('hdcommunity-toolkit doctor');
  const major = Number(process.versions.node.split('.')[0]);
  const nodeOk = major >= NODE_MIN_MAJOR;
  console.log(`  Node.js        ${process.version} ${nodeOk ? 'OK' : `FAIL (>= ${NODE_MIN_MAJOR} required)`}`);
  if (!nodeOk) ok = false;
  console.log(`  package        ${PKG_NAME}@${readPackageVersion()}`);
  const srcOk = skills.length > 0;
  console.log(`  skills source  ${SKILLS_SRC} (${skills.length} skills) ${srcOk ? 'OK' : 'FAIL'}`);
  if (!srcOk) ok = false;
  console.log(`  auth           ${authState()}`);

  const targets = target ? [target] : SUPPORTED_TARGETS.filter((t) => installedSkillCount(t) > 0);
  if (targets.length === 0) {
    console.log(`  targets        none installed — run: npx --yes ${PKG_NAME} install --target <agent>`);
  }
  for (const t of targets) {
    const installed = installedSkillCount(t);
    const mcp = t === 'opencode' ? opencodeMcpState() : 'manual snippet';
    console.log(
      `  ${t.padEnd(14)} skills ${installed}/${skills.length} ${installed === skills.length ? 'OK' : 'MISSING'}  MCP ${mcp}  ${skillsDirFor(t)}`,
    );
    if (installed !== skills.length) ok = false;
    if (t === 'opencode' && mcp !== 'OK') ok = false;
  }
  console.log(ok ? 'doctor: OK' : 'doctor: problems found (see MISSING/FAIL above)');
  return ok;
}

/** Refresh the skills bundled with this CLI version (upgrading = npx @latest). */
function update(target) {
  if (target === 'all') {
    const installed = SUPPORTED_TARGETS.filter((t) => installedSkillCount(t) > 0);
    if (installed.length === 0) {
      console.log(`no installed agent detected — run: npx --yes ${PKG_NAME} install --target <agent|all>`);
      return;
    }
    for (const t of installed) update(t);
    return;
  }
  install(target);
  console.log(
    `[${target}] refreshed to ${PKG_NAME}@${readPackageVersion()}; upgrade with: npx --yes ${PKG_NAME}@latest update --target ${target}`,
  );
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') args.target = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else args._.push(a);
  }
  return args;
}

function printHelp(log = console.log) {
  log(`hdcommunity-toolkit installer

Usage:
  npx ${PKG_NAME} install   [--target <agent|all>]    omit --target to auto-detect
  npx ${PKG_NAME} uninstall [--target <agent|all>]    omit --target to auto-detect
  npx ${PKG_NAME} update    [--target <agent|all>]
  npx ${PKG_NAME} status
  npx ${PKG_NAME} doctor    [--target <agent>]
  npx ${PKG_NAME} help

Targets: ${VALID_TARGETS.join(', ')}

When --target is omitted the installer auto-detects the agent from its config
directory: exactly one detected agent is used; none or several is an error that
lists the valid targets (it never guesses).`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || (args.help ? 'help' : undefined);
  switch (cmd) {
    case 'install': {
      if (args.help) return printHelp();
      const target = resolveTarget(args, 'install');
      if (target) install(target);
      break;
    }
    case 'uninstall': {
      if (args.help) return printHelp();
      const target = resolveTarget(args, 'uninstall');
      if (target) uninstall(target);
      break;
    }
    case 'update': {
      if (args.help) return printHelp();
      const target = resolveTarget(args, 'install');
      if (target) update(target);
      break;
    }
    case 'status':
      if (args.help) {
        printHelp();
        return;
      }
      status();
      break;
    case 'doctor': {
      if (args.help) return printHelp();
      let target = null;
      if (args.target !== undefined) {
        target = resolveTarget(args, 'install');
        if (!target) break;
        if (NON_AGENT_TARGETS.includes(target)) {
          console.error(`--target ${target} is not a single agent; doctor needs one agent`);
          process.exitCode = 1;
          break;
        }
      }
      if (!doctor(target)) process.exitCode = 1;
      break;
    }
    case 'help':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp((line) => console.error(line));
      process.exitCode = 1;
  }
}

main();