// Growth-center endpoint contract — SINGLE SOURCE OF TRUTH (display + user face).
//
// Paths are relative to HDGROW_BASE (which already includes the service context-path
// `/api/v1/hdgrowservice`). Final URL = growBase() + <path below>.
// Do NOT inline paths elsewhere; the tools import these and tests assert the final URL.

/** 展示面（无鉴权） */
export const GROW_SHOW = {
  taskList: '/agent/show/grow/task/list',
  taskCategories: '/agent/show/grow/task/categories',
  prizeList: '/agent/show/grow/prize/list',
};

/** 用户面（AK/SK；身份由网关注入，后端信任 X-User-Id/X-User-Name） */
export const GROW_USER = {
  info: '/agent/user/grow/info',
  tasks: '/agent/user/grow/tasks',
  prizes: '/agent/user/grow/prizes',
  signIn: '/agent/user/grow/sign-in',
  signInStatus: '/agent/user/grow/sign-in/status',
  pointsDetail: '/agent/user/grow/points/detail',
  exchangeRecords: '/agent/user/grow/exchange/records',
  prizeExchange: '/agent/user/grow/prize/exchange',
};