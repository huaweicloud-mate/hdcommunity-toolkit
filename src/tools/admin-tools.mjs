// Admin-facing tools (hdcommunity_admin_*).
// Auth: internal login (username/password) -> Bearer token cached per session.
// Does NOT use Huawei Cloud AK/SK.
//
// Issue #4 enhancements:
//   B1  401 auto-relogin handled centrally in http-client.callAdmin
//   B2  review_batch supports {status, keyword, author} filter + dry_run preview
//   B3  review_batch returns per-id results; failed items are retried once
//   B4  pending pages are sorted oldest-first with a pending duration
//   A1  admin blog page items are content-summarized (content_preview/content_length)
//   A3  hdcommunity_admin_blog_detail (direct backend detail API, degraded composition otherwise)

import { callAdmin } from './http-client.mjs';
import { loginBoth, logoutBoth } from './admin-session.mjs';
import { getSession } from '../session.mjs';
import { ok, fail, CODES } from '../errors.mjs';
import { ADMIN_BLOG_DETAIL_PATH } from '../config.mjs';
import { scanBlog, attachRiskCheck, summarizeBatchRisk } from './risk-control.mjs';

const P = {
  int: (description) => ({ type: 'integer', description }),
  str: (description) => ({ type: 'string', description }),
  bool: (description) => ({ type: 'boolean', description }),
};

const TOKEN_PROP = {
  token: P.str('管理面 token（可选；缺省用当前会话登录态）'),
};

const REVIEW_BATCH_FILTER_PROP = {
  type: 'object',
  description: '条件过滤（与 ids 二选一；缺省 ids 时必填）：按条件收集目标后审核',
  properties: {
    status: P.int('状态：博客 0草稿/1待审/2通过/3驳回；评论 1待审/2通过/3驳回'),
    keyword: P.str('关键词（标题或作者）'),
    author: P.str('作者（精确匹配，客户端过滤）'),
  },
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Extract the item list from a paged backend payload. */
function extractList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

/** Best-effort timestamp (ms) of an item for pending-age computations. */
function timestampOf(item) {
  const v =
    item?.submit_time ?? item?.update_time ?? item?.updated_at ?? item?.create_time ?? item?.created_at ??
    item?.gmt_modified ?? item?.gmt_create ?? null;
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n; // seconds vs milliseconds
  const parsed = Date.parse(String(v));
  return Number.isFinite(parsed) ? parsed : null;
}

function humanDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d${hours % 24}h`;
}

/** B4: for pending pages (status=1), sort oldest-first and annotate pending duration. */
function decoratePendingPage(result, status) {
  if (!result.ok || Number(status) !== 1) return result;
  const data = result.data;
  const list = extractList(data);
  if (!list.length) return result;
  const now = Date.now();
  const sorted = [...list].sort((a, b) => {
    const ta = timestampOf(a);
    const tb = timestampOf(b);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb; // oldest first
  });
  for (const item of sorted) {
    const ts = timestampOf(item);
    if (ts !== null) {
      item.pending_since = ts;
      item.pending_duration = humanDuration(now - ts);
    }
  }
  if (Array.isArray(data)) result.data = sorted;
  else if (Array.isArray(data.list)) data.list = sorted;
  else if (Array.isArray(data.records)) data.records = sorted;
  else if (Array.isArray(data.rows)) data.rows = sorted;
  if (data && typeof data === 'object' && !Array.isArray(data)) data.pending_order = 'oldest_first';
  return result;
}

/** A1 degraded contract: replace full content with a preview + length. */
function summarizeContent(item) {
  if (item && typeof item.content === 'string') {
    const content = item.content;
    item.content_length = content.length;
    item.content_preview = content.slice(0, 200);
    delete item.content;
  }
  return item;
}

/** A4 degraded contract: client-side risk flags over HTML content. */
function computeRiskFlags(content) {
  const c = typeof content === 'string' ? content : '';
  const count = (re) => (c.match(re) || []).length;
  return {
    has_script: /<script\b/i.test(c),
    has_iframe: /<iframe\b/i.test(c),
    has_inline_style: /<style\b|style\s*=/i.test(c),
    has_js_url: /javascript:/i.test(c),
    img_count: count(/<img\b/gi),
    table_count: count(/<table\b/gi),
    link_count: count(/<a\b/gi),
  };
}

function previewItem(item) {
  const out = {
    id: item?.id,
    title: item?.title ?? item?.blog_title ?? null,
    author: item?.author ?? item?.author_name ?? item?.username ?? item?.nickname ?? null,
    status: item?.status ?? null,
  };
  if (typeof item?.content === 'string') {
    out.content_length = item.content.length;
    out.content_preview = item.content.slice(0, 200);
  } else if (typeof item?.content_preview === 'string') {
    out.content_preview = item.content_preview;
    out.content_length = item?.content_length ?? null;
  }
  return out;
}

/** B2: collect target ids (and previews) by filter, client-side composition over the page API. */
async function collectByFilter(sessionId, kind, filter, token) {
  const pagePath = kind === 'blog' ? '/agent/admin/blog/page' : '/agent/admin/comment/page';
  const PAGE_SIZE = 50;
  const MAX_PAGES = 10; // hard cap: 500 items per batch
  const ids = [];
  const items = [];
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await callAdmin(sessionId, 'GET', pagePath, {
      query: { page_no: page, page_size: PAGE_SIZE, status: filter.status, keyword: filter.keyword },
      token,
    });
    if (!r.ok) return r;
    const rawList = extractList(r.data); // original page BEFORE author filtering
    let list = rawList;
    if (filter.author) {
      const want = String(filter.author).toLowerCase();
      list = rawList.filter((it) => {
        const a = it?.author ?? it?.author_name ?? it?.username ?? it?.nickname ?? '';
        return String(a).toLowerCase() === want;
      });
    }
    for (const it of list) {
      ids.push(it.id);
      items.push(previewItem(it));
    }
    // Termination must be based on the RAW page: an author-filtered empty page
    // does NOT mean the backend has no more pages (targets may be on later pages).
    const total = Number(r.data?.total ?? 0);
    const seen = (page - 1) * PAGE_SIZE + rawList.length;
    if (rawList.length === 0 || (total > 0 && seen >= total) || rawList.length < PAGE_SIZE) break;
    if (page === MAX_PAGES) truncated = true; // hit the hard cap without a natural end
  }
  return ok({ ids, items, matched: ids.length, truncated });
}

/**
 * B2 + B3: shared review_batch implementation (blog & comment).
 * - ids OR filter (client-side composition) selects targets
 * - dry_run=true previews {id, summary} without writing
 * - per-id receipt; each failed item is retried once automatically
 */
async function reviewBatch(kind, a, ctx) {
  const singlePath = kind === 'blog' ? '/agent/admin/blog/review' : '/agent/admin/comment/review';

  let ids = Array.isArray(a.ids) ? a.ids.map(Number).filter(Number.isFinite) : [];
  let previewItems = null;
  let truncated = false;

  if (ids.length === 0) {
    const filter = a.filter || {};
    if (filter.status === undefined && !filter.keyword && !filter.author) {
      return fail(CODES.PARAM_ERROR, 'ids 与 filter 至少提供其一（filter 支持 status/keyword/author）');
    }
    const collected = await collectByFilter(ctx.sessionId, kind, filter, a.token);
    if (!collected.ok) return collected;
    ids = collected.data.ids;
    previewItems = collected.data.items;
    truncated = Boolean(collected.data.truncated);
    if (ids.length === 0) {
      return ok({ dry_run: Boolean(a.dry_run), affected: 0, failed: 0, matched: 0, results: [], message: '没有匹配条件的条目' });
    }
  }

  if (a.dry_run) {
    const items = previewItems || ids.map((id) => ({ id }));
    return ok({
      dry_run: true,
      affected: items.length,
      items,
      note: 'dry_run 预览：未执行任何审核写操作',
      ...(truncated ? { truncated: true, truncated_note: '匹配条目较多，已按单批 500 条上限截断，可能仍有未收集到的匹配条目；建议收窄 filter 分批处理' } : {}),
    });
  }

  const results = [];
  let affected = 0;
  let failedCount = 0;
  for (const id of ids) {
    const body = { id, action: a.action, remark: a.remark };
    let r = await callAdmin(ctx.sessionId, 'POST', singlePath, { body, token: a.token });
    let retried = false;
    if (!r.ok) {
      retried = true; // B3: automatic single retry per failed item
      r = await callAdmin(ctx.sessionId, 'POST', singlePath, { body, token: a.token });
    }
    if (r.ok) {
      affected++;
      results.push(retried ? { id, ok: true, retried: true } : { id, ok: true });
    } else {
      failedCount++;
      results.push({ id, ok: false, retried, error: r.error });
    }
  }
  return ok({
    affected,
    failed: failedCount,
    total: ids.length,
    results,
    ...(truncated ? { truncated: true, truncated_note: '匹配条目较多，已按单批 500 条上限截断，可能仍有未收集到的匹配条目；建议收窄 filter 分批处理' } : {}),
  });
}

/** A3 degraded path: locate one blog (full content) by scanning the page API. */
async function findBlogById(sessionId, id, token) {
  const PAGE_SIZE = 50;
  for (let page = 1; page <= 20; page++) {
    const r = await callAdmin(sessionId, 'GET', '/agent/admin/blog/page', {
      query: { page_no: page, page_size: PAGE_SIZE },
      token,
    });
    if (!r.ok) return r;
    const list = extractList(r.data);
    const hit = list.find((it) => Number(it?.id) === Number(id));
    if (hit) return ok(hit);
    const total = Number(r.data?.total ?? 0);
    if (list.length === 0 || (total > 0 && page * PAGE_SIZE >= total) || list.length < PAGE_SIZE) break;
  }
  return fail(CODES.NOT_FOUND, `未找到博客 id=${id}`);
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const ADMIN_TOOLS = {
  definitions: [
    {
      name: 'hdcommunity_admin_login',
      description:
        'Log in with internal account (username/password). Unified: logs into BOTH the community and growth management consoles with the same account, caching each token for this session. 管理面登录（同时登录博客+成长两个管理台）。',
      inputSchema: {
        type: 'object',
        required: ['username', 'password'],
        properties: { username: P.str('内部登录账号'), password: P.str('密码') },
      },
    },
    {
      name: 'hdcommunity_admin_logout',
      description: 'Log out of BOTH management consoles and clear both cached tokens. 管理面注销（同时登出博客+成长）。',
      inputSchema: { type: 'object', properties: { ...TOKEN_PROP } },
    },
    {
      name: 'hdcommunity_admin_blog_page',
      description:
        'Page blogs with filters (for review). Pending list (status=1) is sorted oldest-first with pending duration; full content is summarized to content_preview + content_length. 博客分页（待审最老优先 + 正文摘要化）。',
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
      name: 'hdcommunity_admin_blog_detail',
      description:
        'Get the full review detail of one blog: content (include_content controllable), review history and risk_flags. Uses the backend detail API when available (A3), otherwise falls back to a composed view with a degraded note. 博客审核详情。',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: P.int('博客 id'),
          include_content: P.bool('是否包含正文，默认 true；false 时仅返回 content_preview + content_length'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdcommunity_admin_blog_review',
      description:
        'Review a single blog: approve or reject. Runs a local content risk check (mark-only) first when title/content is provided. 博客审核（可自动风控）。',
      inputSchema: {
        type: 'object',
        required: ['id', 'action'],
        properties: {
          id: P.int('博客 id'),
          action: { type: 'string', enum: ['approve', 'reject'], description: 'approve 通过 / reject 驳回' },
          remark: P.str('审核意见（驳回时建议填写）'),
          title: P.str('博客标题（可选；提供后审核前自动执行本地风控）'),
          content: P.str('博客正文（可选；提供后审核前自动执行本地风控）'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdcommunity_admin_blog_review_batch',
      description:
        'Batch review blogs by explicit ids OR by filter {status, keyword, author}; supports dry_run preview (id + summary list, no writes); returns per-id success/failure details with one automatic retry per failed item. Runs a local content risk check (mark-only) when items provide title/content. 博客批量审核（条件过滤 + 预览 + 按 id 回执 + 可自动风控）。',
      inputSchema: {
        type: 'object',
        required: ['action'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' }, description: '博客 id 列表（与 filter 二选一）' },
          filter: REVIEW_BATCH_FILTER_PROP,
          action: { type: 'string', enum: ['approve', 'reject'] },
          remark: P.str('审核意见'),
          items: {
            type: 'array',
            description: '待审博客文本（可选）：[{id, title, content}]，提供后逐条自动风控',
            items: {
              type: 'object',
              properties: { id: P.int('博客 id'), title: P.str('标题'), content: P.str('正文') },
            },
          },
          dry_run: P.bool('仅预览将影响的条目（id + 摘要），不执行写操作，默认 false'),
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
      description:
        'Page comments with filters (for review). Pending list (status=1) is sorted oldest-first with pending duration. 评论分页（待审最老优先）。',
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
          remark: P.str('审核意见'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdcommunity_admin_comment_review_batch',
      description:
        'Batch review comments by explicit ids OR by filter {status, keyword, author}; supports dry_run preview; returns per-id details with one automatic retry per failed item. 评论批量审核（条件过滤 + 预览 + 按 id 回执）。',
      inputSchema: {
        type: 'object',
        required: ['action'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' }, description: '评论 id 列表（与 filter 二选一）' },
          filter: REVIEW_BATCH_FILTER_PROP,
          action: { type: 'string', enum: ['approve', 'reject'] },
          remark: P.str('审核意见'),
          dry_run: P.bool('仅预览将影响的条目（id + 摘要），不执行写操作，默认 false'),
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
    'hdcommunity_admin_login': async (a, ctx) =>
      // 统一登录：一次登录同时登录「博客 + 成长」两个管理台（同一账号）。
      loginBoth(ctx.sessionId, a.username, a.password),
    'hdcommunity_admin_logout': async (_a, ctx) =>
      // 统一登出：同时登出两个管理台并清空两处缓存令牌。
      logoutBoth(ctx.sessionId),
    'hdcommunity_admin_blog_page': async (a, ctx) => {
      const r = await callAdmin(ctx.sessionId, 'GET', '/agent/admin/blog/page', {
        query: { page_no: a.page_no, page_size: a.page_size, status: a.status, online: a.online, keyword: a.keyword },
        token: a.token,
      });
      if (!r.ok) return r;
      // A1 degraded contract: strip full content from list items (keeps responses KB-sized)
      const list = extractList(r.data);
      for (const item of list) summarizeContent(item);
      // B4: pending list sorted oldest-first + pending duration
      return decoratePendingPage(r, a.status);
    },
    'hdcommunity_admin_blog_detail': async (a, ctx) => {
      const includeContent = a.include_content !== false;
      const detailPath = ADMIN_BLOG_DETAIL_PATH.replace('{id}', encodeURIComponent(a.id));
      // A3 direct path first
      const direct = await callAdmin(ctx.sessionId, 'GET', detailPath, {
        query: { include_content: includeContent ? 1 : 0 },
        token: a.token,
      });
      if (direct.ok) {
        const d = direct.data || {};
        if (!includeContent && typeof d.content === 'string') summarizeContent(d);
        d.source = 'backend_detail';
        return ok(d);
      }
      if (direct.error?.code !== CODES.NOT_FOUND && direct.error?.code !== CODES.PARAM_ERROR) return direct;

      // Degraded composition: page scan (full content) + review records + client-side risk flags
      const found = await findBlogById(ctx.sessionId, a.id, a.token);
      if (!found.ok) return found;
      const detail = { ...found.data };
      if (typeof detail.content === 'string') {
        detail.risk_flags = detail.risk_flags || computeRiskFlags(detail.content);
        if (!includeContent) summarizeContent(detail);
      } else {
        detail.risk_flags = detail.risk_flags || computeRiskFlags('');
      }
      const rec = await callAdmin(ctx.sessionId, 'GET', `/agent/admin/blog/${encodeURIComponent(a.id)}/records`, {
        query: { page_no: 1, page_size: 20 },
        token: a.token,
      });
      if (rec.ok) detail.review_records = extractList(rec.data);
      detail.degraded = true;
      detail.degraded_note =
        '后端 /manage/blog/{id}/detail（A3）未就绪，当前为 MCP 层降级组合（分页定位正文 + 审核记录 + 客户端 risk_flags），后端上线后自动切换直连';
      return ok(detail);
    },
    'hdcommunity_admin_blog_review': async (a, ctx) => {
      // Risk control runs BEFORE the review call; mark-only, never blocks (Issue #3).
      const r = await callAdmin(ctx.sessionId, 'POST', '/agent/admin/blog/review', {
        body: { id: a.id, action: a.action, remark: a.remark },
        token: a.token,
      });
      return attachRiskCheck(r, a.title, a.content);
    },
    'hdcommunity_admin_blog_review_batch': async (a, ctx) => {
      // B2/B3: ids OR filter + dry_run preview + per-id receipt with one automatic retry (Issue #4)
      const r = await reviewBatch('blog', a, ctx);
      // Issue #3: per-item mark-only risk checks (matched by id), aggregated summary.
      const items = Array.isArray(a.items) ? a.items : [];
      const ids = Array.isArray(a.ids) ? a.ids : [];
      const byId = new Map(items.map((it) => [Number(it.id), it]));
      let reports;
      try {
        reports = ids.map((id) => {
          const it = byId.get(Number(id));
          return it && (it.title || it.content) ? scanBlog(it.title, it.content) : null;
        });
      } catch {
        reports = [];
      }
      const checked = reports.filter(Boolean);
      if (!checked.length) return r;
      if (r && r.ok) {
        r.data = { ...(r.data ?? {}), risk_check: { ...summarizeBatchRisk(checked), items: checked } };
      } else if (r) {
        r.risk_check = { ...summarizeBatchRisk(checked), items: checked };
      }
      return r;
    },
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
    'hdcommunity_admin_comment_page': async (a, ctx) => {
      const r = await callAdmin(ctx.sessionId, 'GET', '/agent/admin/comment/page', {
        query: { page_no: a.page_no, page_size: a.page_size, status: a.status, online: a.online, keyword: a.keyword },
        token: a.token,
      });
      // B4: pending list sorted oldest-first + pending duration
      return decoratePendingPage(r, a.status);
    },
    'hdcommunity_admin_comment_review': (a, ctx) =>
      callAdmin(ctx.sessionId, 'POST', '/agent/admin/comment/review', {
        body: { id: a.id, action: a.action, remark: a.remark },
        token: a.token,
      }),
    'hdcommunity_admin_comment_review_batch': (a, ctx) => reviewBatch('comment', a, ctx),
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
