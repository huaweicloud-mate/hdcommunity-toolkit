---
name: hd-blog-operator
description: 'Use when an operator wants to review blogs/comments, take them online/offline, top them, or check the workbench stats on Huawei Cloud Community via the toolkit. Triggers: 审核博客, 审核评论, 待审清理, 上线, 下线, 置顶, 运营, review blog, approve blog. NOT for: authoring blogs (use hd-blog-author).'
version: 1
---

# HDCommunity Blog Operator

**STOP - Do not answer from general knowledge.** Follow the procedure below and use the toolkit MCP tools.

## Overview

Admin-side workflows over MCP: log in with the **internal account** (not AK/SK), page pending content, approve/reject (single or batch), take content online/offline, top blogs, and read workbench stats. Every review writes an audit record.

## Prerequisites

- Admin permission (role→tool whitelist on the backend). If a tool returns `FORBIDDEN`, the account lacks the permission.

## Workflow

| Step | Tool | Notes |
|---|---|---|
| 1. Login | `hdcommunity_admin_login` | internal `username`/`password`; token cached for the session |
| 2. Pending blogs | `hdcommunity_admin_blog_page` | `status=1` = pending |
| 3. Review | `hdcommunity_admin_blog_review` | `action`: `approve` / `reject` (+`reason`); pass `title`/`content` of the blog so a local risk check runs automatically |
| 3b. Batch | `hdcommunity_admin_blog_review_batch` | `ids:[]`, `action`; pass `items:[{id,title,content}]` for per-blog risk checks |
| 4. Online / Top | `hdcommunity_admin_blog_online` / `hdcommunity_admin_blog_top` | approved only |
| 5. Comments | `hdcommunity_admin_comment_page` → `..._comment_review(_batch)` | status: 1待审/2通过/3驳回 |
| 6. Stats | `hdcommunity_admin_stats` | workbench counters |
| 7. Records | `hdcommunity_admin_blog_records` | audit trail per blog |
| 8. Logout | `hdcommunity_admin_logout` | revokes token |

## Content Risk Control (mark-only)

Every review response carries a `risk_check` report (`risk_level`, `categories`, `hits`, `suggestion`) computed locally against a word list — no paid service, no backend call.

- **Automatic**: pass the blog's `title`/`content` (or `items:[{id,title,content}]` for batch) to the review tool and the check runs before the review is submitted.
- **Standalone**: `hdcommunity_admin_blog_risk_check` accepts `{title, content}` alone.
- **Mark-only**: findings NEVER block approval — present `risk_level` + `hits` to the admin, who makes the final call. For `high`/`medium` findings, surface them prominently and recommend human re-review or rejection.
- If `risk_check.status` is `skipped`, the text was not provided; fetch it and re-check, or review manually.
- Word list: built-in seed + optional extension file (`HDCOMMUNITY_RISK_WORDS_FILE` or `~/.config/hdcommunity-toolkit/risk-words.json`) — plug a maintained open-source word bank there for production coverage. Image risk control is planned for a later phase.

## Rules

- **Review is a write action**: always summarize what will be approved/rejected and get user confirmation before calling review/online/top.
- Never fabricate review results; report exactly what the tools return.
- If a tool returns `UNAUTHORIZED`, prompt to re-run `hdcommunity_admin_login`.

## Status Reference

Blog `status`: 0 草稿 · 1 待审 · 2 通过 · 3 驳回；`online`: 0/1；`is_top`: 0/1。
Comment `status`: 1 待审 · 2 通过 · 3 驳回。