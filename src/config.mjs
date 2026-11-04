// Toolkit configuration: backend base URL, region, timeouts.
//
// 用户面/展示面同属该 base（hdblogservice，context-path /api/v1/blogservice）。
// （管理面已迁移到 hdcommunity-mng-toolkit。）

export const BACKEND_BASE = process.env.HDCOMMUNITY_BASE || 'https://opentest-dataset.huaweicloud.com/api/v1/blogservice';

export const REGION = process.env.HW_REGION || 'cn-north-4';

export const DEFAULT_TIMEOUT_MS = Number(process.env.HDCOMMUNITY_TIMEOUT_MS || 30000);

// ---------------------------------------------------------------------------
// Growth center (HDGrowService) — display face only.
//
//   /agent/show/grow/**  public read-only (no auth)     -> callGrowShow
//
// Business (/agent/grow/**) and management (/agent/admin/grow/**) capabilities
// live in hdcommunity-mng-toolkit.
//
// Base MUST be configured explicitly (shape: https://<gateway>/api/v1/hdgrowservice).
// No default: we fail-fast instead of silently hitting an environment
// （默认不再指向任何网关）。
// ---------------------------------------------------------------------------

export function growBase() {
  return process.env.HDGROW_BASE || '';
}
