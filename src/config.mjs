// Toolkit configuration: backend base URLs, region, timeouts.
// Override via env for different environments.

export const BACKEND = {
  // 用户面后端（hdblogservice），context-path /api/v1/blogservice
  blog: process.env.HDCOMMUNITY_BLOG_BASE || 'http://127.0.0.1:8080/api/v1/blogservice',
  // 管理面后端（hdblogmngservice），context-path /api/v1/blogmngservice
  blogmng: process.env.HDCOMMUNITY_BLOGMNG_BASE || 'http://127.0.0.1:8081/api/v1/blogmngservice',
};

// 管理面登录路径：默认沿用现有内部登录接口；Agent 聚合接口就绪后可切到 /agent/admin/login
export const ADMIN_LOGIN_PATH = process.env.HDCOMMUNITY_ADMIN_LOGIN_PATH || '/admin/auth/login';
export const ADMIN_LOGOUT_PATH = process.env.HDCOMMUNITY_ADMIN_LOGOUT_PATH || '/admin/auth/logout';

export const REGION = process.env.HW_REGION || 'cn-north-4';

export const DEFAULT_TIMEOUT_MS = Number(process.env.HDCOMMUNITY_TIMEOUT_MS || 30000);