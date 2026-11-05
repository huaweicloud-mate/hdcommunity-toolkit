# Task: Issue #23 任务拆解

## T1 事实源与 CLI 能力（`src/setup-cli.mjs`）
- [ ] `SUPPORTED_TARGETS` 常量（10 个内置 target，含 `codex-desktop`）
- [ ] `install('all')` / `status()` 从常量派生（修 `status`/`all` 漏 `codex-desktop`）
- [ ] `--help` 的 target 行从常量拼接，并补"省略 `--target` 为自动检测"
- [ ] `resolveTarget(args, mode)`：显式校验 / 自动检测（1 个安装、0 或多报错）
- [ ] `uninstall` 省略 `--target` 时按"已装 Skill"检测
- [ ] `doctor [--target]`：Node / Skill 源 / 认证就绪 / 目标安装与 MCP 条目
- [ ] `update [--target]`：刷新已安装 Skill

## T2 测试（`test/setup-cli.test.mjs`，CLI 进程 seam）
- [ ] help 覆盖 10 target
- [ ] 省略 `--target`：单命中 / 零命中 / 多命中 / 非法值
- [ ] 逐 target 安装落点（含 `codex-desktop`）
- [ ] `install --target all` 覆盖全部内置 target
- [ ] `status` 覆盖全部内置 target 且状态正确
- [ ] `uninstall` 自动检测 + 零命中报错
- [ ] `doctor` 正常 / 未安装 exit 1 / 不泄露凭据
- [ ] `update` 刷新被删 Skill
- [ ] `npm test`、`npm run smoke` 通过

## T3 README 重写（`README.md`）
- [ ] 顶部支持列表（10 Agent + `all`）
- [ ] Quick Start：省略 `--target` 三种分支语义
- [ ] 10 个 Agent 独立小节：install + 路径 + 重启提醒 + doctor/status/update/uninstall
- [ ] dsh 小节：MCP 注册现状 + 关联 #18/PR #22
- [ ] Other Agents：通用 MCP 配置（含 remote HTTP）
- [ ] 原有「认证 / 工具清单 / 配置 / 内置 Skill / 开发 / 许可」保留

## 提交计划（红/绿/文档）
1. `docs(#23)`: spec / plan / task
2. `test(#23)`: 先写失败测试（红）
3. `feat(#23)`: 事实源 + 自动检测 + doctor/update（绿）
4. `docs(#23)`: README 多 Agent 安装结构

## 依赖与合入顺序
- #20/#21/#22 未合入时本 PR 基于 `main`；三者与 `src/setup-cli.mjs` 同文件，合入后需 rebase。
- PR #22（#18 dsh 自动注册）合入后，把 README dsh 小节的"手动添加片段"改为"自动写入 cordis.patch.yml"。