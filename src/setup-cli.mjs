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

function mcpServerEntry() {
  return { type: 'local', command: ['npx', '-y', '-p', PKG_NAME, MCP_BIN], environment: {}, enabled: true };
}

function mergeOpencodeConfig() {
  const candidates = [
    join(home, '.config', 'opencode', 'opencode.json'),
    join(home, '.config', 'opencode', 'opencode.jsonc'),
  ];
  const file = candidates.find((f) => existsSync(f)) || candidates[0];
  let cfg = {};
  if (existsSync(file)) {
    try {
      cfg = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return { merged: false, file, reason: 'existing config not valid JSON' };
    }
  }
  cfg.mcp = cfg.mcp || {};
  cfg.mcp[PKG_NAME] = mcpServerEntry();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2));
  return { merged: true, file };
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