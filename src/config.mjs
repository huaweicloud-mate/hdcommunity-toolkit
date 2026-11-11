// Toolkit configuration: backend base URL, region, timeouts.
//
// 用户面/展示面同属该 base（hdblogservice，context-path /api/v1/blogservice）。

import { homedir } from 'node:os';
import { join } from 'node:path';

// 默认指向现网（open-dataset）；测试环境用 HDCOMMUNITY_BASE 显式覆盖为 opentest-dataset。
export const BACKEND_BASE = process.env.HDCOMMUNITY_BASE || 'https://open-dataset.huaweicloud.com/api/v1/blogservice';

export const REGION = process.env.HW_REGION || 'cn-north-4';

export const DEFAULT_TIMEOUT_MS = Number(process.env.HDCOMMUNITY_TIMEOUT_MS || 30000);

// ---------------------------------------------------------------------------
// Authentication
//
//   aksk    -> Huawei Cloud AK/SK (X-HW-AK/SK headers), the original mode
//   gitcode -> backend-initiated GitCode OAuth, community session token (Bearer)
//   auto    -> use a valid stored GitCode token when present, otherwise fall back to AK/SK
// ---------------------------------------------------------------------------

export const AUTH_MODE = (process.env.HDCOMMUNITY_AUTH_MODE || 'auto').toLowerCase();

export const AUTH_FILE =
  process.env.HDCOMMUNITY_AUTH_FILE || join(homedir(), '.config', 'hdcommunity-toolkit', 'auth.json');

// Backend endpoints for the GitCode login flow (backend starts the GitCode authorization).
export const GITCODE_LOGIN_PATH = process.env.HDCOMMUNITY_GITCODE_LOGIN_PATH || '/agent/auth/gitcode/login';
export const GITCODE_EXCHANGE_PATH = process.env.HDCOMMUNITY_GITCODE_EXCHANGE_PATH || '/agent/auth/gitcode/exchange';
export const GITCODE_LOGOUT_PATH = process.env.HDCOMMUNITY_GITCODE_LOGOUT_PATH || '';
export const GITCODE_TICKET_PARAM = process.env.HDCOMMUNITY_GITCODE_TICKET_PARAM || 'ticket';
// 远程模式（跨机器）：回调结果暂存在后端 state 上，插件轮询取走
export const GITCODE_POLL_PATH = process.env.HDCOMMUNITY_GITCODE_POLL_PATH || '/agent/auth/gitcode/poll';
// Manual (no-browser) exchanges cannot use a loopback redirect; this is sent when configured.
export const GITCODE_REDIRECT_URI = process.env.HDCOMMUNITY_GITCODE_REDIRECT_URI || '';

export const LOGIN_TIMEOUT_MS = Number(process.env.HDCOMMUNITY_LOGIN_TIMEOUT_MS || 120000);

// ---------------------------------------------------------------------------
// Growth center (HDGrowService) — display face + user face.
//
//   /agent/show/grow/**  public read-only (no auth)     -> callGrowShow
//   /agent/user/grow/**  user face (AK/SK; gateway resolves identity) -> callGrow
//
// Operator-facing growth capabilities live in hdcommunity-mng-toolkit.
//
// Here only public reads and self-scoped user calls remain, so a default is safe:
// test gateway by default, override with HDGROW_BASE
// (prod: https://opc-dataset.developer.huaweicloud.com/api/v1/hdgrowservice).
// ---------------------------------------------------------------------------

const DEFAULT_GROW_BASE = 'https://opctest-dataset.developer.huaweicloud.com/api/v1/hdgrowservice';

export function growBase() {
  return process.env.HDGROW_BASE || DEFAULT_GROW_BASE;
}
