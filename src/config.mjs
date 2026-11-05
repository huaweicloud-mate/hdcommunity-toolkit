// Toolkit configuration: backend base URL, region, timeouts.
//
// 用户面/展示面同属该 base（hdblogservice，context-path /api/v1/blogservice）。

// 默认指向现网（open-dataset）；测试环境用 HDCOMMUNITY_BASE 显式覆盖为 opentest-dataset。
export const BACKEND_BASE = process.env.HDCOMMUNITY_BASE || 'https://open-dataset.huaweicloud.com/api/v1/blogservice';

export const REGION = process.env.HW_REGION || 'cn-north-4';

export const DEFAULT_TIMEOUT_MS = Number(process.env.HDCOMMUNITY_TIMEOUT_MS || 30000);