// Growth-center endpoint contract — SINGLE SOURCE OF TRUTH (user-face + business).
//
// Paths are relative to HDGROW_BASE (which already includes the service context-path
// `/api/v1/hdgrowservice`). Final URL = growBase() + <path below>.
// Do NOT inline paths elsewhere; the tools import these and tests assert the final URL.
//
// (Management-console endpoints live in hdcommunity-mng-toolkit.)

/** 展示面（无鉴权） */
export const GROW_SHOW = {
  taskList: '/agent/show/grow/task/list',
  taskCategories: '/agent/show/grow/task/categories',
  prizeList: '/agent/show/grow/prize/list',
};

/** 业务侧（AK/SK） */
export const GROW_BIZ = {
  pointsQuery: '/agent/grow/points/query',
  pointsAdd: '/agent/grow/points/add',
  prizeExchange: '/agent/grow/prize/exchange',
  issueCoupon: '/agent/grow/issue-coupon',
  taskList: '/agent/grow/task/list',
  prizeList: '/agent/grow/prize/list',
};
