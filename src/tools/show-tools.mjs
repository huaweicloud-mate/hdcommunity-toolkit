// Public read-only data tools (hdcommunity_show_*).
// No authentication. Intended for external agents / promotion use.

import { callShow } from './http-client.mjs';

const P = {
  int: (description) => ({ type: 'integer', description }),
  str: (description) => ({ type: 'string', description }),
};

export const SHOW_TOOLS = {
  definitions: [
    {
      name: 'hdcommunity_show_blog_list',
      description: 'List published blogs (public read-only, no login). 公开博客列表。',
      inputSchema: {
        type: 'object',
        properties: { page_no: P.int('页码，默认 1'), page_size: P.int('每页条数，默认 20'), key_word: P.str('标题关键词') },
      },
    },
    {
      name: 'hdcommunity_show_blog_detail',
      description: 'Get a published blog detail (public read-only, no login). 公开博客详情。',
      inputSchema: { type: 'object', required: ['ref'], properties: { ref: P.str('博客 ref') } },
    },
  ],

  call: {
    'hdcommunity_show_blog_list': (a) =>
      callShow('GET', '/agent/show/blog/list', { query: { page_no: a.page_no, page_size: a.page_size, key_word: a.key_word } }),
    'hdcommunity_show_blog_detail': (a) => callShow('GET', '/agent/show/blog/detail', { query: { ref: a.ref } }),
  },
};