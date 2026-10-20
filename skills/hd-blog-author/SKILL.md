---
name: hd-blog-author
description: 'Use when a developer wants to write, publish, edit, or manage their own blog on Huawei Cloud Community through the toolkit. Triggers: 写博客, 发博客, 投稿, 发布文章, publish blog, write article. NOT for: reviewing others'' blogs (use hd-blog-operator), promoting content (use hd-blog-promote).'
version: 2
---

# HDCommunity Blog Author

**STOP - Do not answer from general knowledge.** Follow the procedure below and use the toolkit MCP tools.

## Overview

Guides a developer through authoring a blog post on Huawei Cloud Community: prepare content → (optional) upload cover → publish → check review status → view stats. Publishing enters **pending review** (status=1).

## Content Format (READ FIRST)

- **正文 `content` 必须是 HTML，暂不支持 Markdown。** 使用 `<h1>…</h1>`、`<p>…</p>`、`<strong>…</strong>`、`<img src="…" />` 等标签。
  **不要**使用 `#`、`**粗体**`、`![alt](url)` 等 Markdown 语法——页面按 HTML 渲染，Markdown 会原样显示成文本。
- **图片与链接必须使用完整绝对地址**（不要用相对路径）。`hdcommunity_file_upload` 返回的是相对路径：
  - 返回：`/api/v1/blogservice/file/2bccf386….png`
  - 正文/封面要写成：`https://opentest-dataset.huaweicloud.com/api/v1/blogservice/file/2bccf386….png`
  - 即：绝对地址 = 工具箱配置 `HDCOMMUNITY_BASE` 的 **origin** + 返回的相对路径。

## Prerequisites

- AK/SK configured (toolkit reads `HW_ACCESS_KEY`/`HW_SECRET_KEY` or `~/.config/huaweicloud/credentials.json`).
- If a tool returns `AUTH_MISSING`, tell the user to configure AK/SK first.

## Workflow

| Step | Tool | Notes |
|---|---|---|
| 1. Prepare | — | Draft title + **HTML** body with the user |
| 2. Cover (optional) | `hdcommunity_file_upload` | base64 image → returns a relative URL; make it **absolute** and pass as `cover_url` |
| 3. Publish | `hdcommunity_blog_create` | required: `title`, `content` (**HTML**); returns `ref` |
| 4. Check status | `hdcommunity_blog_detail` | `status`: 1 待审 / 2 通过 / 3 驳回 |
| 5. Edit if rejected | `hdcommunity_blog_update` | pass `ref`; content 仍为 HTML |
| 6. My stats | `hdcommunity_user_stat` | blog count / views / votes |
| 7. Draft instead | `hdcommunity_draft_save` | save without publishing |

## Example content (HTML)

```html
<h1>标题</h1>
<p>正文段落，使用 <strong>粗体</strong>。</p>
<p><img src="https://opentest-dataset.huaweicloud.com/api/v1/blogservice/file/xxx.png" alt="图片" /></p>
<p>结尾段落。</p>
```

## Status Reference

`status`: `0` 草稿 · `1` 待审核 · `2` 已通过 · `3` 已驳回。
`online`: `0` 未上线 · `1` 已上线。驳回原因见 `review_remark`。

## Rules

- **正文用 HTML，不用 Markdown。**
- **图片/链接用完整绝对地址。**
- Never publish without the user's confirmation of the final content.
- After publish, remind the user it enters review; do not claim it is live.