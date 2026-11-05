# Task Breakdown — Issue #26

| # | 任务 | 产出 | 状态 |
|---|---|---|---|
| T1 | 失败测试先行（红） | `test/config.test.mjs`（默认值/覆盖/空串回退）、`test/docs-config.test.mjs`（README 默认值、无 `opentest-dataset`、占位符） | done |
| T2 | 最小实现（绿） | `src/config.mjs` 兜底常量 → `https://open-dataset.huaweicloud.com/api/v1/blogservice` | done |
| T3 | 文档同步 | `README.md` 配置表、`skills/hd-blog-author/SKILL.md:21/46` 占位符化；`docs/issue-26/` spec/plan/task | done |
| T4 | 自审查 + PR | 5 轴审查 + 开源前置增量检查 → PR feat/issue-26 → main | in_progress |

提交策略（TDD 红/绿分提交）：
1. `test(#26): 默认后端域名/覆盖行为/文档无残留 —— 失败测试（红）`
2. `fix(#26): BACKEND_BASE 兜底值切换为现网 open-dataset`
3. `docs(#26): README 与 hd-blog-author 示例改用 <backend-base> 占位符 + issue-26 文档`

验证口径：
- `npm ci && npm test`：现有用例全绿 + 新增配置/文档一致性用例
- 手工核对：`HDCOMMUNITY_BASE` 未设置 → 现网；显式设置为 opentest → 仍生效