// Growth-center tools (hdgrow_*) — display face only.
//
// Scope:
//   A. public read-only  /agent/show/grow/**  (no auth)  -> task_list / task_categories / prize_list
//
// Operator-facing growth capabilities are not part of this package.

import { callGrowShow } from './http-client.mjs';
import { GROW_SHOW } from './grow-endpoints.mjs';

const P = {
  int: (d) => ({ type: 'integer', description: d }),
  str: (d) => ({ type: 'string', description: d }),
  bool: (d) => ({ type: 'boolean', description: d }),
};

// ---------------------------------------------------------------------------
// Tool group
// ---------------------------------------------------------------------------

export const GROW_TOOLS = {
  definitions: [
    // --- A. public read-only (/agent/show/grow, no auth) ---
    {
      name: 'hdgrow_task_list',
      description:
        'List growth-center tasks (public, no auth). 成长中心任务列表（公开只读）。',
      inputSchema: {
        type: 'object',
        properties: {
          category_key: P.str('任务分类 key（可选）'),
          biz_type: P.str('业务类型筛选，如 opc/codearts（可选）'),
          show: P.bool('is_show 筛选：true 仅展示 / false 仅隐藏（可选）'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
        },
      },
    },
    {
      name: 'hdgrow_task_categories',
      description: 'List growth-center task categories (public, no auth). 成长中心任务分类（公开只读）。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hdgrow_prize_list',
      description: 'List growth-center prizes/coupons (public, no auth). 成长中心权益(代金券)列表（公开只读）。',
      inputSchema: {
        type: 'object',
        properties: { page_no: P.int('页码，默认 1'), page_size: P.int('每页条数，默认 10') },
      },
    },
  ],

  call: {
    // --- A. public read-only ---
    'hdgrow_task_list': (a) =>
      callGrowShow('GET', GROW_SHOW.taskList, {
        query: {
          category_key: a.category_key,
          biz_type: a.biz_type,
          show: a.show,
          page_no: a.page_no,
          page_size: a.page_size,
        },
      }),
    'hdgrow_task_categories': () => callGrowShow('GET', GROW_SHOW.taskCategories),
    'hdgrow_prize_list': (a) =>
      callGrowShow('GET', GROW_SHOW.prizeList, { query: { page_no: a.page_no, page_size: a.page_size } }),
  },
};