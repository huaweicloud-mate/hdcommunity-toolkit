#!/usr/bin/env node
// Experience Officer report script (hd-experience).
//
// Mirrors the reference "submit.mjs": authenticate with AK/SK and POST the
// experience case directly to the Experience Officer service. No toolkit backend storage.
//
// Usage:
//   node report.mjs --title "..." --description "..." --steps-json '<json>' [--dry-run] [--endpoint <url>]
//   node report.mjs --case case.json [--dry-run]
//
// Env:
//   HDOFFICER_ENDPOINT   report endpoint (required unless --dry-run)
//   HW_ACCESS_KEY / HW_SECRET_KEY / HW_SECURITY_TOKEN  (or ~/.config/huaweicloud/credentials.json)

import { request } from 'undici';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'dry-run') args[key] = true;
    else args[key] = argv[++i];
  }
  return args;
}

function loadCreds() {
  let ak = process.env.HW_ACCESS_KEY || process.env.HUAWEICLOUD_SDK_AK || '';
  let sk = process.env.HW_SECRET_KEY || process.env.HUAWEICLOUD_SDK_SK || '';
  let securityToken = process.env.HW_SECURITY_TOKEN || process.env.HUAWEICLOUD_SDK_SECURITY_TOKEN || '';
  if (!ak || !sk) {
    try {
      const v = JSON.parse(readFileSync(join(homedir(), '.config', 'huaweicloud', 'credentials.json'), 'utf8'));
      ak = ak || v.ak || '';
      sk = sk || v.sk || '';
      securityToken = securityToken || v.securityToken || '';
    } catch {
      /* no vault */
    }
  }
  return { ak, sk, securityToken };
}

function buildCase(args) {
  if (args.case) {
    return JSON.parse(readFileSync(args.case, 'utf8'));
  }
  let steps = [];
  if (args['steps-json']) {
    try {
      steps = JSON.parse(args['steps-json']);
    } catch {
      throw new Error('--steps-json is not valid JSON');
    }
  }
  return {
    case_id: args['case-id'] || `case-${Date.now()}`,
    title: args.title || '',
    description: args.description || '',
    steps,
    evidence: {},
    reported_at: new Date().toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const caseObj = buildCase(args);
  const endpoint = process.env.HDOFFICER_ENDPOINT || args.endpoint || '';

  if (args['dry-run'] || !endpoint) {
    console.log(
      JSON.stringify(
        { mode: endpoint ? 'dry-run' : 'local (endpoint not configured)', endpoint: endpoint || null, payload: caseObj },
        null,
        2,
      ),
    );
    return;
  }

  const creds = loadCreds();
  if (!creds.ak || !creds.sk) {
    console.error('缺少 AK/SK：请配置 HW_ACCESS_KEY/HW_SECRET_KEY 或 ~/.config/huaweicloud/credentials.json');
    process.exitCode = 1;
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-HW-AK': creds.ak,
    'X-HW-SK': creds.sk,
  };
  if (creds.securityToken) headers['X-HW-Security-Token'] = creds.securityToken;

  const res = await request(endpoint, { method: 'POST', headers, body: JSON.stringify(caseObj) });
  const text = await res.body.text();
  console.log(JSON.stringify({ status: res.statusCode, body: text }, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});