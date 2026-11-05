// hdcommunity-toolkit installer CLI.
// Commands: install | uninstall | status | help
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
// written by the installers (this package and the same-shaped
// hdcommunity-mng-toolkit installer) are deleted. Entries modified by the user
// are kept and reported instead of being overwritten.
const CLEANED_TOOLKIT_PKGS = ['hdcommunity-toolkit', 'hdcommunity-mng-toolkit'];

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

function printGenericSnippet() {
  const snippet = {
    mcpServers: {
      [PKG_NAME]: { command: 'npx', args: ['-y', '-p', PKG_NAME, MCP_BIN] },
    },
  };
  console.log('Add this MCP server to your agent config:\n');
  console.log(JSON.stringify(snippet, null, 2));
}

function install(target) {
  if (target === 'all') {
    const all = ['opencode', 'codex', 'codearts', 'codearts-work', 'workbuddy', 'dsh', 'hermes', 'openclaw', 'atomcode'];
    for (const t of all) install(t);
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
  const targets = ['opencode', 'codex', 'codearts', 'codearts-work', 'workbuddy', 'dsh', 'hermes', 'openclaw', 'atomcode'];
  for (const t of targets) {
    const dest = skillsDirFor(t);
    const present = existsSync(dest) && listSkills().some((s) => existsSync(join(dest, s)));
    console.log(`  ${t.padEnd(14)} ${present ? 'installed' : '-'}  ${dest}`);
  }
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

function printHelp() {
  console.log(`hdcommunity-toolkit installer

Usage:
  npx hdcommunity-toolkit install   --target <agent|all>
  npx hdcommunity-toolkit uninstall --target <agent>
  npx hdcommunity-toolkit status
  npx hdcommunity-toolkit help

Targets: opencode, codex, codex-desktop, codearts, codearts-work, workbuddy, dsh, hermes, openclaw, atomcode, all`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || (args.help ? 'help' : undefined);
  switch (cmd) {
    case 'install':
      install(args.target || 'opencode');
      break;
    case 'uninstall':
      uninstall(args.target || 'opencode');
      break;
    case 'status':
      status();
      break;
    case 'help':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exitCode = 1;
  }
}

main();