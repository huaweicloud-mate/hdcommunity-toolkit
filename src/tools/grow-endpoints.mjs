// Growth-center endpoint contract — SINGLE SOURCE OF TRUTH.
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

/** 业务侧（AK/SK） */
export const GROW_BIZ = {
  pointsQuery: '/agent/grow/points/query',
  pointsAdd: '/agent/grow/points/add',
  prizeExchange: '/agent/grow/prize/exchange',
  issueCoupon: '/agent/grow/issue-coupon',
  taskList: '/agent/grow/task/list',
  prizeList: '/agent/grow/prize/list',
  // 登录/注销走真实路径（管理台认证）
  login: '/manage/auth/login',
  logout: '/manage/auth/logout',
};

/** 管理台（Bearer） */
export const GROW_ADMIN = {
  change: '/agent/admin/grow/change',
  taskPage: '/agent/admin/grow/task/page',
  taskGet: (id) => `/agent/admin/grow/task/${encodeURIComponent(id)}`,
  prizePage: '/agent/admin/grow/prize/page',
  prizeGet: (id) => `/agent/admin/grow/prize/${encodeURIComponent(id)}`,
  whitelistPage: '/agent/admin/grow/whitelist/page',
  recordPoints: '/agent/admin/grow/points/detail/page',
  recordExchange: '/agent/admin/grow/exchange/record/page',
  recordIssue: '/agent/admin/grow/issue/record/page',
  recordJob: '/agent/admin/grow/job/record/page',
  userPage: '/agent/admin/grow/user/page',
  stats: {
    overview: '/agent/admin/grow/stats/overview',
    stock: '/agent/admin/grow/stats/stock',
    exchange_trend: '/agent/admin/grow/stats/exchange-trend',
    task_distribution: '/agent/admin/grow/stats/task-distribution',
  },
};
