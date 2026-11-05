# Task Breakdown — Issue #18

| # | 任务 | 产出 | 状态 |
|---|---|---|---|
| T1 | 失败测试先行（红） | `test/setup-cli-dsh.test.mjs`：patch 渲染语法/幂等检查/移除/无效文件 + CLI install/uninstall/CONFIG_MISSING/update/doctor 用例 | done |
| T2 | 最小实现（绿） | `src/dsh-patch.mjs`（文本手术）+ `src/setup-cli.mjs`（dsh patch 写入/移除/幂等/CONFIG_MISSING fail-fast 接线） | done |
| T3 | 文档同步 | `docs/issue-18/` spec/plan/task；README 安装节与 DSH 小节改为"安装即自动注册" | done |
| T4 | 自审查 + PR | 5 轴审查 + 开源前置增量检查 → PR feat/issue-18 → main | done |
| T5 | rebase 到 main（v0.6.0）后的移植 | 与 #23 的 target 注册表/doctor/update 对齐；dsh 用例独立成文件；纯函数抽到 `src/dsh-patch.mjs` | done |

提交策略（TDD 红/绿分提交；rebase 后重写为单条线性历史）：
1. `test(#18): dsh MCP patch 写入/移除/幂等/CONFIG_MISSING 失败测试（红）`
2. `feat(#18): install --target dsh 自动写入 cordis.patch.yml MCP 注册`（含既有 installer 用例的 `HDGROW_BASE` 适配）
3. `docs(#18): 需求/方案/任务文档与 README 同步`

验证口径（rebase 后）：
- `npm ci && npm test`：68/68 通过（含新增 dsh 用例 30 条）
- `npm run smoke`：`tools: 22`（#25 已移除 `hdgrow_*`，属预期）