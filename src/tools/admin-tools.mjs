// Admin-facing tools (hdcommunity_admin_*).
// Auth: internal login (username/password) -> Bearer token cached per session.
// Does NOT use Huawei Cloud AK/SK.

import { callAdmin, loginAdmin, logoutAdmin } from './http-client.mjs';
import { setSessionToken, clearSessionToken, getSession } from '../session.mjs';
import { ok } from '../errors.mjs';

const P = {
  int: (description) => ({ type: 'integer', description }),
  str: (description) => ({ type: 'string', description }),
};

const TOKEN_PROP = {
  token: P.str('管理面 token（可选；缺省用当前会话登录态）'),
};

export const ADMIN_TOOLS = {
  definitions: [
    {
      name: 'hdcommunity_admin_login',
      description:
        'Log in to the admin console with internal account (username/password). Returns a token and caches it for this session. 管理面登录。',
      inputSchema: {
        type: 'object',
        required: ['username', 'password'],
        properties: { username: P.str('内部登录账号'), password: P.str('密码') },
      },
    },
    {
      name: 'hdcommunity_admin_logout',
      description: 'Log out the admin session (revokes token). 管理面注销。',
      inputSchema: { type: 'object', properties: { ...TOKEN_PROP } },
    },
    {
      name: 'hdcommunity_admin_blog_page',
      description: 'Page blogs with filters (for review). 博客分页。',
      inputSchema: {
        type: 'object',
        properties: {
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          status: P.int('状态：0草稿/1待审/2通过/3驳回'),
          online: P.int('上线：0/1'),
          keyword: P.str('关键词（标题或作者）'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdcommunity_admin_blog_review',
      description: 'Review a single blog: approve or reject. 博客审核。',
      inputSchema: {
        type: 'object',
        required: ['id', 'action'],
        properties: {
          id: P.int('博客 id'),
          action: { type: 'string', enum: ['approve', 'reject'], description: 'approve 通过 / reject 驳回' },
          reason: P.str('审核意见（驳回时建议填写）'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdcommunity_admin_blog_review_batch',
      description: 'Batch review blogs. 博客批量审核。',
      inputSchema: {
        type: 'object',
        required: ['ids', 'action'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' }, description: '博客 id 列表' },
          action: { type: 'string', enum: ['approve', 'reject'] },
          reason: P.str('审核意见'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdcommunity_admin_blog_online',
      description: 'Set blog online/offline (approved blogs only). 博客上线/下线。',
      inputSchema: {
        type: 'object',
        required: ['id', 'online'],
        properties: { id: P.int('博客 id'), online: P.int('1 上线 / 0 下线'), ...TOKEN_PROP },
      },
    },
    {
      name: 'hdcommunity_admin_blog_top',
      description: 'Set blog top/untop (approved & online only). 博客置顶。',
      inputSchema: {
        type: 'object',
        required: ['id', 'top'],
        properties: { id: P.int('博客 id'), top: P.int('1 置顶 / 0 取消'), ...TOKEN_PROP },
      },
    },
    {
      name: 'hdcommunity_admin_blog_records',
      description: 'Page review records of a blog. 博客审核记录。',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: { id: P.int('博客 id'), page_no: P.int('页码，默认 1'), page_size: P.int('每页条数，默认 10'), ...TOKEN_PROP },
      },
    },
    {
      name: 'hdcommunity_admin_comment_page',
      description: 'Page comments with filters (for review). 评论分页。',
      inputSchema: {
        type: 'object',
        properties: {
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          status: P.int('状态：1待审/2通过/3驳回'),
          online: P.int('上线：0/1'),
          keyword: P.str('关键词'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdcommunity_admin_comment_review',
      description: 'Review a single comment. 评论审核。',
      inputSchema: {
        type: 'object',
        required: ['id', 'action'],
        properties: {
          id: P.int('评论 id'),
          action: { type: 'string', enum: ['approve', 'reject'] },
          reason: P.str('审核意见'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdcommunity_admin_comment_review_batch',
      description: 'Batch review comments. 评论批量审核。',
      inputSchema: {
        type: 'object',
        required: ['ids', 'action'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' } },
          action: { type: 'string', enum: ['approve', 'reject'] },
          reason: P.str('审核意见'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdcommunity_admin_comment_online',
      description: 'Set comment online/offline (approved only). 评论上线/下线。',
      inputSchema: {
        type: 'object',
        required: ['id', 'online'],
        properties: { id: P.int('评论 id'), online: P.int('1 上线 / 0 下线'), ...TOKEN_PROP },
      },
    },
    {
      name: 'hdcommunity_admin_stats',
      description: 'Get admin workbench stats. 工作台统计。',
      inputSchema: { type: 'object', properties: { ...TOKEN_PROP } },
    },
  ],

  call: {
    'hdcommunity_admin_login': async (a, ctx) => {
      const r = await loginAdmin(a.username, a.password);
      if (!r.ok) return r;
      const d = r.data || {};
      const user = d.user || {};
      setSessionToken(ctx.sessionId, { token: d.token, username: user.username, role: user.role });
      return ok({ token: d.token, user });
    },
    'hdcommunity_admin_logout': async (a, ctx) => {
      const r = await logoutAdmin(ctx.sessionId, a.token);
      clearSessionToken(ctx.sessionId);
      return r.ok ? ok({ loggedOut: true }) : r;
    },
    'hdcommunity_admin_blog_page': (a, ctx) =>
      callAdmin(ctx.sessionId, 'GET', '/agent/admin/blog/page', {
        query: { page_no: a.page_no, page_size: a.page_size, status: a.status, online: a.online, keyword: a.keyword },
        token: a.token,
      }),
    'hdcommunity_admin_blog_review': (a, ctx) =>
      callAdmin(ctx.sessionId, 'POST', '/agent/admin/blog/review', {
        body: { id: a.id, action: a.action, reason: a.reason },
        token: a.token,
      }),
    'hdcommunity_admin_blog_review_batch': (a, ctx) =>
      callAdmin(ctx.sessionId, 'POST', '/agent/admin/blog/review/batch', {
        body: { ids: a.ids, action: a.action, reason: a.reason },
        token: a.token,
      }),
    'hdcommunity_admin_blog_online': (a, ctx) =>
      callAdmin(ctx.sessionId, 'POST', '/agent/admin/blog/online', {
        body: { id: a.id, online: a.online },
        token: a.token,
      }),
    'hdcommunity_admin_blog_top': (a, ctx) =>
      callAdmin(ctx.sessionId, 'POST', '/agent/admin/blog/top', {
        body: { id: a.id, top: a.top },
        token: a.token,
      }),
    'hdcommunity_admin_blog_records': (a, ctx) =>
      callAdmin(ctx.sessionId, 'GET', `/agent/admin/blog/${encodeURIComponent(a.id)}/records`, {
        query: { page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdcommunity_admin_comment_page': (a, ctx) =>
      callAdmin(ctx.sessionId, 'GET', '/agent/admin/comment/page', {
        query: { page_no: a.page_no, page_size: a.page_size, status: a.status, online: a.online, keyword: a.keyword },
        token: a.token,
      }),
    'hdcommunity_admin_comment_review': (a, ctx) =>
      callAdmin(ctx.sessionId, 'POST', '/agent/admin/comment/review', {
        body: { id: a.id, action: a.action, reason: a.reason },
        token: a.token,
      }),
    'hdcommunity_admin_comment_review_batch': (a, ctx) =>
      callAdmin(ctx.sessionId, 'POST', '/agent/admin/comment/review/batch', {
        body: { ids: a.ids, action: a.action, reason: a.reason },
        token: a.token,
      }),
    'hdcommunity_admin_comment_online': (a, ctx) =>
      callAdmin(ctx.sessionId, 'POST', '/agent/admin/comment/online', {
        body: { id: a.id, online: a.online },
        token: a.token,
      }),
    'hdcommunity_admin_stats': (a, ctx) =>
      callAdmin(ctx.sessionId, 'GET', '/agent/admin/stats', { token: a.token }),
  },
};

// Expose current session for debugging / introspection (optional helper).
export function currentAdminSession(sessionId) {
  return getSession(sessionId);
}