// Toolkit configuration: backend base URL, region, timeouts.
//
// 用户面/展示面同属该 base（hdblogservice，context-path /api/v1/blogservice）。

export const BACKEND_BASE = process.env.HDCOMMUNITY_BASE || 'https://opentest-dataset.huaweicloud.com/api/v1/blogservice';

export const REGION = process.env.HW_REGION || 'cn-north-4';

export const DEFAULT_TIMEOUT_MS = Number(process.env.HDCOMMUNITY_TIMEOUT_MS || 30000);

// ---------------------------------------------------------------------------
// Growth center (HDGrowService) — display face + user face.
//
//   /agent/show/grow/**  public read-only (no auth)     -> callGrowShow
//   /agent/user/grow/**  user face (AK/SK; gateway resolves identity) -> callGrow
//
// Operator-facing growth capabilities are not part of this package.
//
// Here only public reads and self-scoped user calls remain, so a default is safe:
// test gateway by default, override with HDGROW_BASE
// (prod: https://opc-dataset.developer.huaweicloud.com/api/v1/hdgrowservice).
// ---------------------------------------------------------------------------

const DEFAULT_GROW_BASE = 'https://opctest-dataset.developer.huaweicloud.com/api/v1/hdgrowservice';

export function growBase() {
  return process.env.HDGROW_BASE || DEFAULT_GROW_BASE;
}
