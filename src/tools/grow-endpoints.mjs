// Growth-center endpoint contract — SINGLE SOURCE OF TRUTH (display face only).
//
// Paths are relative to HDGROW_BASE (which already includes the service context-path
// `/api/v1/hdgrowservice`). Final URL = growBase() + <path below>.
// Do NOT inline paths elsewhere; the tools import these and tests assert the final URL.
//
// Business-side (/agent/grow/**) and management-console endpoints live in
// hdcommunity-mng-toolkit.

/** 展示面（无鉴权） */
export const GROW_SHOW = {
  taskList: '/agent/show/grow/task/list',
  taskCategories: '/agent/show/grow/task/categories',
  prizeList: '/agent/show/grow/prize/list',
};