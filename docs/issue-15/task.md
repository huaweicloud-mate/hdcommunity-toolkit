# Task Breakdown: Issue #15

- [ ] T1 文档：spec.md / plan.md / task.md 归档（docs/issue-15/）
- [ ] T2 红：test/setup-cli-help.test.mjs 复现症状（install --help / uninstall --help 应打印帮助、退出码 0、无副作用；无位置参数 --help 回归）
- [ ] T3 绿：src/setup-cli.mjs install/uninstall 分支 args.help 守卫，使测试通过
- [ ] T4 回归：npm test 全量通过（含既有 10 项测试）
- [ ] T5 提交推送 + 建 PR（base=main）+ Issue 评论告知 + A2A QA
