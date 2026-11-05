# Task Breakdown: Issue #16

- [ ] T1 文档：spec.md / plan.md / task.md 归档（docs/issue-16/）
- [ ] T2 红测试：test/setup-cli.test.mjs —— install→uninstall 后 MCP 条目残留复现（当前行为变红）
- [ ] T3 实现：src/setup-cli.mjs uninstall opencode 分支新增 pruneOpencodeConfig 对称清理 + 保留提示输出
- [ ] T4 回归：npm test 全量通过（含既有 grow 测试）；npm run smoke 通过
- [ ] T5 自审查：五轴审查 + 开源前置增量检查（黑名单拦截 + 敏感信息增量扫描）
- [ ] T6 交付：push feat/issue-16 → 建 PR（base=main）→ Issue 评论告知 → A2A 通知 QA
