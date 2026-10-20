// User-facing blog tools (hdcommunity_blog_* / draft_* / comment_* / user_* / file_*).
// Auth: AK/SK injected per request by callBlog().

import { callBlog } from './http-client.mjs';

const P = {
  int: (description) => ({ type: 'integer', description }),
  str: (description) => ({ type: 'string', description }),
};

export const BLOG_TOOLS = {
  definitions: [
    {
      name: 'hdcommunity_blog_list',
      description: 'List published blogs (paginated, title search). 看博客列表。',
      inputSchema: {
        type: 'object',
        properties: {
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 20'),
          key_word: P.str('标题关键词（可选）'),
          type: P.int('类型过滤（可选）'),
        },
      },
    },
    {
      name: 'hdcommunity_blog_detail',
      description: 'Get a blog detail by ref. 看博客详情。',
      inputSchema: {
        type: 'object',
        required: ['ref'],
        properties: { ref: P.str('博客 ref，如 blog-123'), log_view: { type: 'boolean', description: '是否记浏览量，默认 false' } },
      },
    },
    {
      name: 'hdcommunity_blog_create',
      description: 'Create (publish) a new blog. Enters pending-review after submit. 写/发博客。',
      inputSchema: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: P.str('标题'),
          content: P.str('正文（Markdown 或 HTML）'),
          intro: P.str('摘要（可选）'),
          cover_url: P.str('封面图 URL（可选，可先调 hdcommunity_file_upload）'),
        },
      },
    },
    {
      name: 'hdcommunity_blog_update',
      description: 'Update an existing blog by ref. 编辑博客。',
      inputSchema: {
        type: 'object',
        required: ['ref'],
        properties: {
          ref: P.str('博客 ref'),
          title: P.str('标题'),
          content: P.str('正文'),
          intro: P.str('摘要'),
          cover_url: P.str('封面图 URL'),
        },
      },
    },
    {
      name: 'hdcommunity_blog_delete',
      description: 'Delete a blog (author only). 删除博客。',
      inputSchema: { type: 'object', required: ['ref'], properties: { ref: P.str('博客 ref') } },
    },
    {
      name: 'hdcommunity_draft_list',
      description: 'List my drafts. 草稿列表。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hdcommunity_draft_save',
      description: 'Save a draft (create or update). 保存草稿。',
      inputSchema: {
        type: 'object',
        required: ['content'],
        properties: { draft_id: P.int('草稿 id（编辑时传）'), title: P.str('标题'), content: P.str('正文') },
      },
    },
    {
      name: 'hdcommunity_draft_delete',
      description: 'Delete a draft by id. 删除草稿。',
      inputSchema: { type: 'object', required: ['draft_id'], properties: { draft_id: P.int('草稿 id') } },
    },
    {
      name: 'hdcommunity_comment_list',
      description: 'List comments of a blog (two levels). 评论列表。',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: P.str('博客 ref'),
          level: P.int('层级：1 一级 / 2 二级'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 20'),
        },
      },
    },
    {
      name: 'hdcommunity_comment_add',
      description: 'Add a comment (enters pending review). 发表评论。',
      inputSchema: {
        type: 'object',
        required: ['blog_ref', 'content'],
        properties: {
          blog_ref: P.str('博客 ref'),
          content: P.str('评论内容'),
          parent_id: P.str('父评论 id（二级评论时传）'),
        },
      },
    },
    {
      name: 'hdcommunity_comment_edit',
      description: 'Edit my comment. 编辑评论。',
      inputSchema: {
        type: 'object',
        required: ['comment_id', 'content'],
        properties: { comment_id: P.str('评论 id'), content: P.str('新内容') },
      },
    },
    {
      name: 'hdcommunity_comment_delete',
      description: 'Delete my comment (first-level delete cascades children). 删除评论。',
      inputSchema: { type: 'object', required: ['comment_id'], properties: { comment_id: P.str('评论 id') } },
    },
    {
      name: 'hdcommunity_blog_vote',
      description: 'Like / unlike a blog. 点赞/取消点赞。',
      inputSchema: {
        type: 'object',
        required: ['ref', 'operation_type'],
        properties: { ref: P.str('博客 ref'), operation_type: P.int('1 点赞 / 0 取消') },
      },
    },
    {
      name: 'hdcommunity_blog_favorite',
      description: 'Favorite / unfavorite a blog. 收藏/取消收藏。',
      inputSchema: {
        type: 'object',
        required: ['ref', 'operation_type'],
        properties: { ref: P.str('博客 ref'), operation_type: P.int('1 收藏 / 0 取消') },
      },
    },
    {
      name: 'hdcommunity_blog_follow',
      description: 'Follow / unfollow an author. 关注/取消关注作者。',
      inputSchema: {
        type: 'object',
        required: ['author_uid', 'operation_type'],
        properties: { author_uid: P.str('作者 uid'), operation_type: P.int('1 关注 / 0 取消') },
      },
    },
    {
      name: 'hdcommunity_user_profile',
      description: 'Get my profile (nickname, avatar). 我的个人信息。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hdcommunity_user_stat',
      description: 'Get my stats (blog count, views, votes). 我的统计。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hdcommunity_file_upload',
      description: 'Upload an image (base64) and get its URL, for use as blog cover. 上传图片。',
      inputSchema: {
        type: 'object',
        required: ['name', 'content_base64'],
        properties: { name: P.str('文件名（含扩展名，如 cover.png）'), content_base64: P.str('图片内容的 base64') },
      },
    },
  ],

  call: {
    'hdcommunity_blog_list': (a) =>
      callBlog('GET', '/agent/blog/list', {
        query: { type: a.type, page_no: a.page_no, page_size: a.page_size, key_word: a.key_word },
      }),
    'hdcommunity_blog_detail': (a) =>
      callBlog('GET', '/agent/blog/detail', { query: { ref: a.ref, log_view: a.log_view } }),
    'hdcommunity_blog_create': (a) =>
      callBlog('POST', '/agent/blog/save', {
        body: { title: a.title, content: a.content, intro: a.intro, cover_url: a.cover_url },
      }),
    'hdcommunity_blog_update': (a) =>
      callBlog('POST', '/agent/blog/save', {
        body: { ref: a.ref, title: a.title, content: a.content, intro: a.intro, cover_url: a.cover_url },
      }),
    'hdcommunity_blog_delete': (a) => callBlog('DELETE', `/agent/blog/${encodeURIComponent(a.ref)}`),
    'hdcommunity_draft_list': () => callBlog('GET', '/agent/blog/draft/list'),
    'hdcommunity_draft_save': (a) =>
      callBlog('POST', '/agent/blog/draft/save', { body: { draft_id: a.draft_id, title: a.title, content: a.content } }),
    'hdcommunity_draft_delete': (a) => callBlog('DELETE', `/agent/blog/draft/${encodeURIComponent(a.draft_id)}`),
    'hdcommunity_comment_list': (a) =>
      callBlog('GET', '/agent/blog/comment/list', {
        query: { id: a.id, level: a.level, page_no: a.page_no, page_size: a.page_size },
      }),
    'hdcommunity_comment_add': (a) =>
      callBlog('POST', '/agent/blog/comment/add', {
        body: { blog_ref: a.blog_ref, content: a.content, parent_id: a.parent_id },
      }),
    'hdcommunity_comment_edit': (a) =>
      callBlog('POST', '/agent/blog/comment/edit', { body: { comment_id: a.comment_id, content: a.content } }),
    'hdcommunity_comment_delete': (a) =>
      callBlog('DELETE', `/agent/blog/comment/${encodeURIComponent(a.comment_id)}`),
    'hdcommunity_blog_vote': (a) =>
      callBlog('POST', '/agent/blog/vote', { body: { ref: a.ref, operation_type: a.operation_type } }),
    'hdcommunity_blog_favorite': (a) =>
      callBlog('POST', '/agent/blog/favorite', { body: { ref: a.ref, operation_type: a.operation_type } }),
    'hdcommunity_blog_follow': (a) =>
      callBlog('POST', '/agent/blog/follow', { body: { author_uid: a.author_uid, operation_type: a.operation_type } }),
    'hdcommunity_user_profile': () => callBlog('GET', '/agent/blog/user/profile'),
    'hdcommunity_user_stat': () => callBlog('GET', '/agent/blog/user/stat'),
    'hdcommunity_file_upload': (a) =>
      callBlog('POST', '/agent/blog/file/upload', { body: { name: a.name, content_base64: a.content_base64 } }),
  },
};