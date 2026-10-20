---
name: hd-blog-author
description: 'Use when a developer wants to write, publish, edit, or manage their own blog on Huawei Cloud Community through the toolkit. Triggers: 写博客, 发博客, 投稿, 发布文章, publish blog, write article. NOT for: reviewing others'' blogs (use hd-blog-operator), promoting content (use hd-blog-promote).'
version: 1
---

# HDCommunity Blog Author

**STOP - Do not answer from general knowledge.** Follow the procedure below and use the toolkit MCP tools.

## Overview

Guides a developer through authoring a blog post on Huawei Cloud Community: prepare content → (optional) upload cover → publish → check review status → view stats. Publishing enters **pending review** (status=1).

## Prerequisites

- AK/SK configured (toolkit reads `HW_ACCESS_KEY`/`HW_SECRET_KEY` or `~/.config/huaweicloud/credentials.json`).
- If a tool returns `AUTH_MISSING`, tell the user to configure AK/SK first.

## Workflow

| Step | Tool | Notes |
|---|---|---|
| 1. Prepare | — | Draft title + body (Markdown/HTML) with the user |
| 2. Cover (optional) | `hdcommunity_file_upload` | base64 image → returns URL, pass as `cover_url` |
| 3. Publish | `hdcommunity_blog_create` | required: `title`, `content`; returns `ref` |
| 4. Check status | `hdcommunity_blog_detail` | `status`: 1 待审 / 2 通过 / 3 驳回 |
| 5. Edit if rejected | `hdcommunity_blog_update` | pass `ref` |
| 6. My stats | `hdcommunity_user_stat` | blog count / views / votes |
| 7. Draft instead | `hdcommunity_draft_save` | save without publishing |

## Status Reference

`status`: `0` 草稿 · `1` 待审核 · `2` 已通过 · `3` 已驳回。
`online`: `0` 未上线 · `1` 已上线。驳回原因见 `review_remark`。

## Rules

- Never publish without the user's confirmation of the final content.
- After publish, remind the user it enters review; do not claim it is live.