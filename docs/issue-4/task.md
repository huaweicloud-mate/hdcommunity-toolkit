# Task Breakdown: Issue #4

- [x] T1 文档：spec.md / plan.md / task.md 归档（docs/issue-4/）
- [x] T2 B1：errors.mjs NEED_LOGIN + credentials.mjs 管理员凭据 + config.mjs A3 路径 + http-client.mjs callAdmin 401 自动重登
- [x] T3 B4：admin blog/comment page 待审最老优先排序 + 待审时长；admin blog page 正文摘要化（A1 降级）
- [x] T4 B2+B3：blog/comment review_batch 条件过滤 + dry_run 预览 + 按 id 回执 + 失败自动重试一次
- [x] T5 M3：hdcommunity_admin_blog_detail（A3 直连 + 降级组合 + 客户端 risk_flags）；hdcommunity_blog_detail include_content
- [x] T6 测试：test/review-enhancements.test.mjs（401 重登成功/失败、dry_run、回执明细、排序、摘要化、detail 降级）；npm run smoke 回归
- [x] T7 文档同步：README 工具清单/配置表/典型流程 + skills/hd-blog-operator 工作流
