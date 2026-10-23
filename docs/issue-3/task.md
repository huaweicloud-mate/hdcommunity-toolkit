# Task Breakdown — Issue #3

| # | 任务 | 产出 | 状态 |
|---|---|---|---|
| T1 | 风控引擎与词库 | `src/tools/risk-control.mjs`（归一化、Trie、分级、扩展词库） | done |
| T2 | 独立风控 MCP 工具 | `hdcommunity_admin_blog_risk_check` 定义+处理器 | done |
| T3 | 审核前自动风控 | `admin-tools.mjs` review / review_batch 接入 `attachRiskCheck` | done |
| T4 | 注册与脚本 | `index.mjs` GROUPS 并入 RISK_TOOLS；`package.json` 增 test 脚本 | done |
| T5 | skill/README 同步 | operator skill 工作流 + README 工具清单 | done |
| T6 | 测试 | `tests/risk-control.test.mjs` + smoke 回归 | done |
| T7 | 图片风控调研结论 | PR 交付说明（二期：本地开源模型方案，超一期复杂度，延后） | done |
| T8 | PR + 评论 + A2A QA | feat/issue-3 → main | done |

提交策略（原子提交）：
1. `docs(issue-3): 需求文档与方案设计`
2. `feat(risk): #3 本地 DFA 风控引擎与独立风控工具`
3. `feat(review): #3 审核前自动风控接入 review/review_batch`
4. `docs(skill): #3 operator 工作流与 README 补风控说明`
5. `test(risk): #3 风控引擎与工具测试`
