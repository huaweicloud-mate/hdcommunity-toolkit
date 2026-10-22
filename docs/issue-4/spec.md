# Spec: Issue #4 — MCP 工具层博客审核体验增强（B1-B4 + A 系列契约对齐）

> 来源：Issue #4 评论 issuecomment-6336442377（issue agent 生成的权威 Spec），本文件为仓库内归档副本。

## Objective
MCP 工具层博客审核体验增强：
- **B1** 401 自动重登（`HDCOMMUNITY_ADMIN_USER/PASS` env 优先、credentials.json 兜底；callAdmin 统一拦截，重登重试一次，仍失败才报 `NEED_LOGIN`）
- **B2** `review_batch` 条件过滤 `{status, keyword, author}` + `dry_run` 预览（id + 摘要列表）
- **B3** 批量回执按 id 成功/失败明细，失败项自动重试一次
- **B4** 待审默认「最老优先」+ 待审时长展示
- 消费后端 A 系列字段契约（`content_preview` / `review_rounds` / `risk_flags` 等），A1-A4 未上线时 MCP 层降级组合

## Scope
- In：`src/tools/http-client.mjs`、`src/session.mjs`、`src/credentials.mjs`、`src/config.mjs`、`src/errors.mjs`、`src/tools/admin-tools.mjs`、`src/tools/blog-tools.mjs`、`src/tools/index.mjs`、`README.md`、`skills/hd-blog-operator`
- Out：A1-A4 后端实现（归 HDBlogService 仓）；评论侧 detail、前端 UI（后续迭代）

## Acceptance Criteria
- [ ] callAdmin 遇 401 自动重登并重试一次，重登失败才返回 NEED_LOGIN（含配置指引）
- [ ] review_batch 支持 {status, keyword, author} 过滤 + dry_run 预览（id+摘要列表）
- [ ] 批量回执按 id 明细 + 失败项自动重试一次
- [ ] 待审列表默认最老优先并展示待审时长
- [ ] 存在 blog 详情原语（include_content 可控；A3 未就绪时降级说明）
- [ ] 现有测试全过 + 新增覆盖 401 重登 / dry_run / 回执明细
- [ ] README 与 hd-blog-operator skill 同步
