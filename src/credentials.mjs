// AK/SK credential loading.
//
// Priority (highest first):
//   1. env vars   HW_ACCESS_KEY / HW_SECRET_KEY / HW_SECURITY_TOKEN (+ HUAWEICLOUD_SDK_* aliases)
//   2. devkit S1 vault   ~/.config/huaweicloud/credentials.json   {ak, sk, securityToken, region}
//   3. KooCLI profile    ~/.hcloud/config.json
//
// NOTE: only the credential FILE FORMAT is reused from huaweicloud-devkit.
// We deliberately do NOT import any huaweicloud-devkit internal module.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Resolve AK/SK/securityToken/region/projectId from env or files.
 * @returns {{ak: string, sk: string, securityToken: string, region: string, projectId: string}}
 */
export function loadCredentials() {
  let ak = process.env.HW_ACCESS_KEY || process.env.HUAWEICLOUD_SDK_AK || process.env.HW_AK || '';
  let sk = process.env.HW_SECRET_KEY || process.env.HUAWEICLOUD_SDK_SK || process.env.HW_SK || '';
  let securityToken = process.env.HW_SECURITY_TOKEN || process.env.HUAWEICLOUD_SDK_SECURITY_TOKEN || '';
  let region = process.env.HW_REGION || '';
  let projectId = process.env.HW_PROJECT_ID || process.env.HUAWEICLOUD_PROJECT_ID || '';

  if (!ak || !sk) {
    const vault = readJson(join(homedir(), '.config', 'huaweicloud', 'credentials.json'));
    if (vault) {
      ak = ak || vault.ak || vault.accessKeyId || '';
      sk = sk || vault.sk || vault.secretAccessKey || '';
      securityToken = securityToken || vault.securityToken || vault.security_token || '';
      region = region || vault.region || '';
      projectId = projectId || vault.projectId || '';
    }
  }

  if (!ak || !sk) {
    const cfg = readJson(join(homedir(), '.hcloud', 'config.json'));
    const list = Array.isArray(cfg?.profiles) ? cfg.profiles : [];
    const cur = list.find((p) => p.name === (cfg?.current || 'default')) || list[0];
    if (cur) {
      ak = ak || cur.accessKeyId || '';
      sk = sk || cur.secretAccessKey || '';
      region = region || cur.region || '';
      projectId = projectId || cur.projectId || '';
    }
  }

  return { ak, sk, securityToken, region: region || 'cn-north-4', projectId };
}

/**
 * @param {{ak?: string, sk?: string}} creds
 * @returns {boolean}
 */
export function hasCredentials(creds) {
  return Boolean(creds?.ak && creds?.sk);
}

/**
 * Resolve admin console credentials for 401 auto-relogin (B1).
 * Priority: env HDCOMMUNITY_ADMIN_USER/PASS > credentials.json admin_user/admin_pass.
 * @returns {{adminUser: string, adminPass: string}}
 */
export function loadAdminCredentials() {
  let adminUser = process.env.HDCOMMUNITY_ADMIN_USER || '';
  let adminPass = process.env.HDCOMMUNITY_ADMIN_PASS || '';
  if (!adminUser || !adminPass) {
    const vault = readJson(join(homedir(), '.config', 'huaweicloud', 'credentials.json'));
    if (vault) {
      adminUser = adminUser || vault.admin_user || vault.adminUser || '';
      adminPass = adminPass || vault.admin_pass || vault.adminPass || '';
    }
  }
  return { adminUser, adminPass };
}

/**
 * @param {{adminUser?: string, adminPass?: string}} creds
 * @returns {boolean}
 */
export function hasAdminCredentials(creds) {
  return Boolean(creds?.adminUser && creds?.adminPass);
}

/** Mask an AK for logs. */
export function maskAk(ak) {
  if (!ak || typeof ak !== 'string') return '';
  return ak.length > 8 ? `${ak.slice(0, 8)}***` : '***';
}
