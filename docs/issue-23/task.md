# Task: Issue #23 任务拆解

## T1 事实源与 CLI 能力（`src/setup-cli.mjs`）
- [x] `SUPPORTED_TARGETS` 常量（10 个内置 target，含 `codex-desktop`）
- [x] `install('all')` / `status()` 从常量派生（修 `status`/`all` 漏 `codex-desktop`）
- [x] `--help` 的 target 行从常量拼接，并补"省略 `--target` 为自动检测"
- [x] `resolveTarget(args, mode)`：显式校验 / 自动检测（1 个安装、0 或多报错）
- [x] `uninstall` 省略 `--target` 时按"已装 Skill"检测
- [x] `doctor [--target]`：Node / Skill 源 / 认证就绪 / 目标安装与 MCP 条目
- [x] `update [--target]`：刷新已安装 Skill；省略 `--target` 时按"已装 Skill"检测（不写未安装 Agent）
- [x] `--target` 缺值报错（列出可选值），不落入自动检测

## T2 测试（`test/setup-cli.test.mjs`，CLI 进程 seam）
- [x] help 覆盖 10 target
- [x] 省略 `--target`：单命中 / 零命中 / 多命中 / 非法值
- [x] 逐 target 安装落点（含 `codex-desktop`）
- [x] `install --target all` 覆盖全部内置 target
- [x] `status` 覆盖全部内置 target 且状态正确
- [x] `uninstall` 自动检测 + 零命中报错
- [x] `doctor` 正常 / 未安装 exit 1 / 不泄露凭据
- [x] `update` 刷新被删 Skill
- [x] `update` 省略 `--target`：只刷新已安装 Agent，未安装不落盘
- [x] `--target` 缺值报错且不落盘
- [x] `npm test`、`npm run smoke` 通过

## T3 README 重写（`README.md`）
- [x] 顶部支持列表（10 Agent + `all`）
- [x] Quick Start：省略 `--target` 三种分支语义
- [x] Quick Start：`update` 省略 `--target` 的行为（只刷新已安装 Agent）
- [x] 10 个 Agent 独立小节：install + 路径 + 重启提醒 + doctor/status/update/uninstall
- [x] dsh 小节：MCP 注册现状 + 关联 #18/PR #22
- [x] Other Agents：通用 MCP 配置（含 remote HTTP）
- [x] 原有「认证 / 工具清单 / 配置 / 内置 Skill / 开发 / 许可」保留

## 提交计划（红/绿/文档）
1. `docs(#23)`: spec / plan / task
2. `test(#23)`: 先写失败测试（红）
3. `feat(#23)`: 事实源 + 自动检测 + doctor/update（绿）
4. `docs(#23)`: README 多 Agent 安装结构

## 依赖与合入顺序
- #19/#20/#21 已合入 `main`（`ed8a282`，v0.5.0），本 PR 已 rebase 并保留 #21 的 OpenCode 卸载 MCP 清理与 #16 的按包名 MCP 条目。
- PR #22（#18 dsh 自动注册）仍 open；合入后把 README dsh 小节的"手动添加片段"改为"自动写入 cordis.patch.yml"。
