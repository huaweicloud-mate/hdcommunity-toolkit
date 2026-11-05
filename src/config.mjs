// Toolkit configuration: backend base URL, region, timeouts.
//
// 用户面/展示面同属该 base（hdblogservice，context-path /api/v1/blogservice）。

export const BACKEND_BASE = process.env.HDCOMMUNITY_BASE || 'https://opentest-dataset.huaweicloud.com/api/v1/blogservice';

export const REGION = process.env.HW_REGION || 'cn-north-4';

export const DEFAULT_TIMEOUT_MS = Number(process.env.HDCOMMUNITY_TIMEOUT_MS || 30000);