---
name: hd-blog-operator
description: 'Use when an operator wants to review blogs/comments, take them online/offline, top them, or check the workbench stats on Huawei Cloud Community via the toolkit. Triggers: 审核博客, 审核评论, 待审清理, 上线, 下线, 置顶, 运营, review blog, approve blog. NOT for: authoring blogs (use hd-blog-author).'
version: 2
---

# HDCommunity Blog Operator

**STOP - Do not answer from general knowledge.** Follow the procedure below and use the toolkit MCP tools.

## Overview

Admin-side workflows over MCP: log in with the **internal account** (not AK/SK), page pending content (oldest-first, summarized), inspect full details per blog, approve/reject (single or batch with preview), take content online/offline, top blogs, and read workbench stats. Every review writes an audit record.

## Prerequisites

- Admin permission (role→tool whitelist on the backend). If a tool returns `FORBIDDEN`, the account lacks the permission.
- Optional but recommended: set `HDCOMMUNITY_ADMIN_USER` / `HDCOMMUNITY_ADMIN_PASS` so expired sessions (401) are re-logged-in automatically; otherwise a 401 surfaces as `NEED_LOGIN` and you must call `hdcommunity_admin_login` again.

## Workflow

| Step | Tool | Notes |
|---|---|---|
| 1. Login | `hdcommunity_admin_login` | internal `username`/`password`; token cached for the session (401 auto-relogin when env creds are configured) |
| 2. Pending blogs | `hdcommunity_admin_blog_page` | `status=1` = pending; **oldest-first** with `pending_duration` per item; content summarized to `content_preview`/`content_length` |
| 2b. Inspect | `hdcommunity_admin_blog_detail` | `{ id, include_content? }` — full content (controllable), review history, `risk_flags` (script/iframe/style detection); degraded composition is flagged with a note when backend detail API is not ready |
| 3. Review | `hdcommunity_admin_blog_review` | `action`: `approve` / `reject` (+`remark`) |
| 3b. Batch | `hdcommunity_admin_blog_review_batch` | by `ids:[]` **or** `filter:{status, keyword, author}`; **always `dry_run:true` first** to preview the affected `{id, summary}` list, then execute; the receipt returns per-id success/failure with one automatic retry per failed item |
| 4. Online / Top | `hdcommunity_admin_blog_online` / `hdcommunity_admin_blog_top` | approved only |
| 5. Comments | `hdcommunity_admin_comment_page` → `..._comment_review(_batch)` | pending list also oldest-first; batch supports filter + dry_run + per-id receipt |
| 6. Stats | `hdcommunity_admin_stats` | workbench counters |
| 7. Records | `hdcommunity_admin_blog_records` | audit trail per blog |
| 8. Logout | `hdcommunity_admin_logout` | revokes token |

## Rules

- **Review is a write action**: always summarize what will be approved/rejected and get user confirmation before calling review/online/top. For batches, run `dry_run:true` and show the preview list to the user first.
- Work the queue oldest-first: start from the top of the `status=1` page (longest pending first) and check `pending_duration`.
- Never fabricate review results; report exactly what the tools return, including per-id failures from batch receipts.
- If a tool returns `NEED_LOGIN`/`UNAUTHORIZED`, re-run `hdcommunity_admin_login` (or configure `HDCOMMUNITY_ADMIN_USER/PASS` for automatic relogin).
- Watch `risk_flags` (e.g. `has_script`, `has_iframe`) from `hdcommunity_admin_blog_detail` before approving.

## Status Reference

Blog `status`: 0 草稿 · 1 待审 · 2 通过 · 3 驳回；`online`: 0/1；`is_top`: 0/1。
Comment `status`: 1 待审 · 2 通过 · 3 驳回。
