// Toolkit configuration: backend base URL, admin paths, region, timeouts.
//
// v1.2: 用户面与管理面已合并为单一服务（hdblogservice，context-path /api/v1/blogservice）。
// 用户面/管理面/展示面的 Agent 接口同属该 base，管理面真实登录接口在 /manage/auth/*。

export const BACKEND_BASE = process.env.HDCOMMUNITY_BASE || 'https://opentest-dataset.huaweicloud.com/api/v1/blogservice';

// 管理面真实登录接口（可直接对接现有后端）
export const ADMIN_LOGIN_PATH = process.env.HDCOMMUNITY_ADMIN_LOGIN_PATH || '/manage/auth/login';
export const ADMIN_LOGOUT_PATH = process.env.HDCOMMUNITY_ADMIN_LOGOUT_PATH || '/manage/auth/logout';

// 管理面博客详情接口（后端 A3 契约；{id} 为占位符）
export const ADMIN_BLOG_DETAIL_PATH = process.env.HDCOMMUNITY_ADMIN_BLOG_DETAIL_PATH || '/manage/blog/{id}/detail';

export const REGION = process.env.HW_REGION || 'cn-north-4';

export const DEFAULT_TIMEOUT_MS = Number(process.env.HDCOMMUNITY_TIMEOUT_MS || 30000);

// ---------------------------------------------------------------------------
// Growth center (HDGrowService) — parallel capability to the community/blog side.
//
//   /agent/show/grow/**  public read-only (no auth)     -> callGrowShow
//   /agent/grow/**       business (AK/SK, per request)   -> callGrow
//   /agent/admin/grow/** management (Bearer)             -> callGrowAdmin
//
// Base uses the service context-path /api/v1/hdgrowservice. Default = test gateway;
// switch to prod via HDGROW_BASE.
// ---------------------------------------------------------------------------

export const HDGROW_BASE =
  process.env.HDGROW_BASE || 'https://opctest-dataset.developer.huaweicloud.com/api/v1/hdgrowservice';