---
name: hd-blog-promote
description: 'Use when an operator wants to read published blogs and turn them into promotion copy for external platforms (e.g. Bilibili, WeChat). Triggers: 推广, 文案, 宣传, 转载, promote, repost, marketing copy. NOT for: reviewing or authoring blogs.'
version: 1
---

# HDCommunity Blog Promote

**STOP - Do not answer from general knowledge.** Follow the procedure below and use the toolkit MCP tools.

## Overview

Reads **public** blog data (no login required) and generates platform-adapted promotion copy. This skill only **generates copy** — it does not auto-publish to any platform.

## Workflow

| Step | Tool | Notes |
|---|---|---|
| 1. Pick content | `hdcommunity_show_blog_list` | filter by `key_word` |
| 2. Read detail | `hdcommunity_show_blog_detail` | needs `ref` |
| 3. Generate | — | produce title / summary / script / cover suggestion per target platform |

## Output Template

For each blog, produce:

```
【平台】Bilibili / 公众号 / 微博 …
【标题】≤ 30 字，含钩子
【正文/简介】3–5 句，突出价值
【话题标签】#tag1 #tag2 …
【封面建议】一句描述
```

## Rules

- Use only facts present in the blog detail; do not invent metrics or claims.
- Respect the original author's attribution (keep author name and link).