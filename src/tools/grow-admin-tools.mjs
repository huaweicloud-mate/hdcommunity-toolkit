// Growth-center MANAGEMENT CONSOLE tools (hdgrow_admin_*) — parallel to hdcommunity_admin_*.
// Auth: internal account login -> Bearer token cached per session (dedicated namespace).
//
// Covers: login/logout, change-request flow (draft/commit/approve/apply/revert/get/page),
// read-only task/prize/whitelist queries, record audit, user search, stats.
//
// Money-safety: config writes go through the change-request flow (HIGH risk needs a second
// approver != submitter). These tools never bypass that; create returns a one-time confirm_token.

import { callGrowAdmin, loginGrowAdmin, logoutGrowAdmin } from './http-client.mjs';
import { GROW_ADMIN } from './grow-endpoints.mjs';
import { setGrowToken, clearGrowToken } from '../session.mjs';
import { ok, fail, CODES } from '../errors.mjs';

const P = {
  int: (d) => ({ type: 'integer', description: d }),
  str: (d) => ({ type: 'string', description: d }),
  bool: (d) => ({ type: 'boolean', description: d }),
};

const TOKEN_PROP = { token: P.str('管理台 token（可选；缺省用当前会话登录态）') };

export const GROW_ADMIN_TOOLS = {
  definitions: [
    {
      name: 'hdgrow_admin_login',
      description: 'Log in to the growth management console (internal account) and cache the token. 管理台登录。',
      inputSchema: {
        type: 'object',
        required: ['username', 'password'],
        properties: { username: P.str('内部账号'), password: P.str('登录口令') },
      },
    },
    {
      name: 'hdgrow_admin_logout',
      description: 'Log out the growth management session (revokes token). 管理台注销。',
      inputSchema: { type: 'object', properties: { ...TOKEN_PROP } },
    },

    // ---- change-request flow ----
    {
      name: 'hdgrow_admin_change_create',
      description:
        'Create a money-config change draft (no write). Returns diff/money impact/risk + one-time confirm_token. 生成涉钱配置变更单草案。',
      inputSchema: {
        type: 'object',
        required: ['target_type', 'field_group', 'after'],
        properties: {
          target_type: P.str('task / prize / whitelist / user'),
          target_id: P.str('目标ID（新建为空；user 调整必填）'),
          field_group: P.str('points / face_value / quantity / shelf / auth / points_adjust'),
          after: { type: 'object', description: '目标值（snake_case 键），如 {"points":100,"points_limit":10000}' },
          reason: P.str('变更原因（可选）'),
        },
      },
    },
    {
      name: 'hdgrow_admin_change_commit',
      description: 'Submitter confirms the draft with confirm_token; LOW/MID -> READY, HIGH -> PENDING_APPROVAL. 提交人确认。',
      inputSchema: {
        type: 'object',
        required: ['id', 'confirm_token', 'reason'],
        properties: {
          id: P.str('变更单 id'),
          confirm_token: P.str('创建时返回的一次性令牌'),
          reason: P.str('变更原因'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_change_approve',
      description: 'Approver approves/rejects a HIGH change (approver != submitter). 审批高风险变更。',
      inputSchema: {
        type: 'object',
        required: ['id', 'decision'],
        properties: {
          id: P.str('变更单 id'),
          decision: P.str('approve / reject'),
          comment: P.str('审批意见（可选）'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_change_apply',
      description: 'Apply a READY change (writes to the target table). 生效变更单。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('变更单 id'), ...TOKEN_PROP } },
    },
    {
      name: 'hdgrow_admin_change_revert',
      description: 'Revert an APPLIED change (restore before-snapshot / disable created). 回滚变更单。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('变更单 id'), ...TOKEN_PROP } },
    },
    {
      name: 'hdgrow_admin_change_get',
      description: 'Get a change request detail. 变更单详情。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('变更单 id'), ...TOKEN_PROP } },
    },
    {
      name: 'hdgrow_admin_change_page',
      description: 'Page change requests (status/submitter). 变更单分页。',
      inputSchema: {
        type: 'object',
        properties: {
          status: P.str('DRAFT/READY/PENDING_APPROVAL/APPLIED/REJECTED/REVERTED'),
          submitter: P.str('提交人（可选）'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },

    // ---- read-only config queries ----
    {
      name: 'hdgrow_admin_task_page',
      description: 'Page tasks (management view, incl. disabled/deleted). 管理台任务分页。',
      inputSchema: {
        type: 'object',
        properties: {
          category_id: P.str('分类筛选'),
          enabled: P.int('启用筛选 1/0'),
          is_show: P.int('展示筛选 1/0'),
          deleted: P.int('删除筛选 1/0（缺省 0）'),
          keyword: P.str('标题/task_tag 关键词'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_task_get',
      description: 'Get a task detail (management view). 管理台任务详情。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('任务 id'), ...TOKEN_PROP } },
    },
    {
      name: 'hdgrow_admin_prize_page',
      description: 'Page prizes (management view, incl. off-shelf/deleted). 管理台权益分页。',
      inputSchema: {
        type: 'object',
        properties: {
          on_shelf: P.int('上架筛选 1/0'),
          deleted: P.int('删除筛选 1/0（缺省 0）'),
          keyword: P.str('名称关键词'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_prize_get',
      description: 'Get a prize detail (management view). 管理台权益详情。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('权益 id'), ...TOKEN_PROP } },
    },
    {
      name: 'hdgrow_admin_whitelist_page',
      description: 'Page API whitelist entries. 管理台白名单分页。',
      inputSchema: {
        type: 'object',
        properties: {
          service_name: P.str('服务名关键词'),
          auth_type: P.str('appcode / iam'),
          enabled: P.int('启用筛选 1/0'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },

    // ---- record audit ----
    {
      name: 'hdgrow_admin_record_points',
      description: 'Page points-detail records (audit). 积分明细审计。',
      inputSchema: {
        type: 'object',
        properties: {
          user_id: P.str('用户ID'),
          type: P.str('task/exchange/operate'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_record_exchange',
      description: 'Page exchange records (audit). 兑换记录审计。',
      inputSchema: {
        type: 'object',
        properties: {
          user_id: P.str('用户ID'),
          prize_id: P.str('权益ID'),
          status: P.str('success/failed/pending'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_record_issue',
      description: 'Page coupon-issue records (audit). 发券记录审计。',
      inputSchema: {
        type: 'object',
        properties: {
          domain_id: P.str('租户ID'),
          status: P.str('SUCCESS/FAILED'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_record_job',
      description: 'Page scheduled-job records (audit). 定时任务记录审计。',
      inputSchema: {
        type: 'object',
        properties: {
          job_code: P.str('任务标识'),
          batch_no: P.str('批次号'),
          status: P.str('RUNNING/SUCCESS/FAILED'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_user_page',
      description: 'Page users (search by domain/iam/name). 用户查询。',
      inputSchema: {
        type: 'object',
        properties: {
          domain_id: P.str('domainId'),
          iam_id: P.str('iamId'),
          domain_name: P.str('域名关键词（模糊）'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },

    // ---- stats ----
    {
      name: 'hdgrow_admin_stats',
      description: 'Growth stats: overview / stock / exchange_trend / task_distribution. 统计看板。',
      inputSchema: {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: P.str('overview / stock / exchange_trend / task_distribution'),
          days: P.int('exchange_trend 天数，默认 7'),
          ...TOKEN_PROP,
        },
      },
    },
  ],

  call: {
    'hdgrow_admin_login': async (a, ctx) => {
      const r = await loginGrowAdmin(a.username, a.password);
      if (!r.ok) return r;
      const d = r.data || {};
      setGrowToken(ctx?.sessionId, { token: d.token, username: d.username, role: d.role });
      return ok({ username: d.username, role: d.role });
    },
    'hdgrow_admin_logout': async (a, ctx) => {
      const r = await logoutGrowAdmin(ctx?.sessionId, a.token);
      clearGrowToken(ctx?.sessionId);
      return r;
    },

    'hdgrow_admin_change_create': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.change, {
        body: { target_type: a.target_type, target_id: a.target_id, field_group: a.field_group, after: a.after, reason: a.reason },
        token: a.token,
      }),
    'hdgrow_admin_change_commit': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'POST', `${GROW_ADMIN.change}/${encodeURIComponent(a.id)}/commit`, {
        body: { confirm_token: a.confirm_token, reason: a.reason },
        token: a.token,
      }),
    'hdgrow_admin_change_approve': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'POST', `${GROW_ADMIN.change}/${encodeURIComponent(a.id)}/approve`, {
        body: { decision: a.decision, comment: a.comment },
        token: a.token,
      }),
    'hdgrow_admin_change_apply': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'POST', `${GROW_ADMIN.change}/${encodeURIComponent(a.id)}/apply`, { token: a.token }),
    'hdgrow_admin_change_revert': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'POST', `${GROW_ADMIN.change}/${encodeURIComponent(a.id)}/revert`, { token: a.token }),
    'hdgrow_admin_change_get': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', `${GROW_ADMIN.change}/${encodeURIComponent(a.id)}`, { token: a.token }),
    'hdgrow_admin_change_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', `${GROW_ADMIN.change}/page`, {
        query: { status: a.status, submitter: a.submitter, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),

    'hdgrow_admin_task_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.taskPage, {
        query: {
          category_id: a.category_id,
          enabled: a.enabled,
          is_show: a.is_show,
          deleted: a.deleted,
          keyword: a.keyword,
          page_no: a.page_no,
          page_size: a.page_size,
        },
        token: a.token,
      }),
    'hdgrow_admin_task_get': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.taskGet(a.id), { token: a.token }),
    'hdgrow_admin_prize_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.prizePage, {
        query: { on_shelf: a.on_shelf, deleted: a.deleted, keyword: a.keyword, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdgrow_admin_prize_get': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.prizeGet(a.id), { token: a.token }),
    'hdgrow_admin_whitelist_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.whitelistPage, {
        query: {
          service_name: a.service_name,
          auth_type: a.auth_type,
          enabled: a.enabled,
          page_no: a.page_no,
          page_size: a.page_size,
        },
        token: a.token,
      }),

    'hdgrow_admin_record_points': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.recordPoints, {
        query: { user_id: a.user_id, type: a.type, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdgrow_admin_record_exchange': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.recordExchange, {
        query: { user_id: a.user_id, prize_id: a.prize_id, status: a.status, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdgrow_admin_record_issue': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.recordIssue, {
        query: { domain_id: a.domain_id, status: a.status, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdgrow_admin_record_job': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.recordJob, {
        query: { job_code: a.job_code, batch_no: a.batch_no, status: a.status, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdgrow_admin_user_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.userPage, {
        query: { domain_id: a.domain_id, iam_id: a.iam_id, domain_name: a.domain_name, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),

    'hdgrow_admin_stats': (a, ctx) => {
      const kind = String(a.kind || '');
      const pathMap = GROW_ADMIN.stats;
      const path = pathMap[kind];
      if (!path) return fail(CODES.PARAM_ERROR, 'kind 须为 overview / stock / exchange_trend / task_distribution');
      return callGrowAdmin(ctx?.sessionId, 'GET', path, {
        query: kind === 'exchange_trend' ? { days: a.days } : undefined,
        token: a.token,
      });
    },
  },
};
