# Spec: Issue #23 — README 多 Agent 支持与逐 Agent 安装流程

> 目标分支：`main` ｜ 关联：Issue #23、PR #19/#20/#21/#22（行为依赖见 §5）

## 1. 背景

README 安装节只有一条 `npx --yes hdcommunity-toolkit install --target opencode`，用 `...` 省略了其余 target；用户与 AI Agent 都无法从文档得知"到底支持哪些 Agent、各自怎么装、装完怎么验证"。参考 `huaweicloud-devkit` 的 README 组织方式（支持列表 → Quick Start 逐 Agent → Other Agents），本 Issue 重写 README 安装章节，并让安装脚本成为这些描述的唯一事实源。

## 2. 目标

1. README 顶部一句话给出全部内置 Agent 列表，并说明"省略 `--target` 会怎样"。
2. 每个内置 Agent 一个独立小节：install 命令、安装路径、重启会话提醒、`status` / `uninstall` 等后续命令。
3. README 承诺的能力与 `src/setup-cli.mjs` 实际行为逐条一致（列表、路径、命令、报错语义）。
4. 脚本侧抽出租 target 列表单一常量，`status` / `all` 覆盖全部 target（含 `codex-desktop`），并实现省略 `--target` 的自动检测。

## 3. 内置 target 与安装路径（脚本现状核实）

| target | Agent | Skill 目录 | MCP 注册方式（当前 main） |
|---|---|---|---|
| `opencode` | OpenCode | `~/.config/opencode/skills` | 自动合并 `~/.config/opencode/opencode.json` |
| `codex` | Codex CLI | `~/.codex/skills` | 打印通用 MCP 片段 |
| `codex-desktop` | Codex Desktop | `~/.codex/skills`（与 `codex` 同目录） | 打印通用 MCP 片段 |
| `codearts` | CodeArts Agent | `~/.codeartsdoer/skills` | 打印通用 MCP 片段 |
| `codearts-work` | CodeArts Work | `~/.codeartswork/skills` | 打印通用 MCP 片段 |
| `workbuddy` | WorkBuddy | `~/.workbuddy/skills` | 打印通用 MCP 片段 |
| `dsh` | DeepSeek Harness | `$DSH_HOME/skills`（默认 `~/.dsh/skills`） | 见 §5 dsh 说明 |
| `hermes` | Hermes | `~/.hermes/skills` | 打印通用 MCP 片段 |
| `openclaw` | OpenClaw | `~/.openclaw/skills` | 打印通用 MCP 片段 |
| `atomcode` | AtomCode | `~/.atomcode/skills` | 打印通用 MCP 片段 |

另有 `all`（逐个内置 target 安装）与 `generic`（仅通用 MCP 片段，不落 Agent 专属目录）。

## 4. 省略 `--target` 的行为（本 Issue 新增）

| 场景 | 行为 |
|---|---|
| `install` 未给 `--target`，检测到 **1** 个 Agent | 直接对该 Agent 安装，并打印 `[auto] detected agent: <target>` |
| 未给 `--target`，检测到 **0** 个 | 报错退出（exit 1）：未检测到受支持的 Agent，列出全部可选 target |
| 未给 `--target`，检测到 **多个** | 报错退出（exit 1）：拒绝猜测，列出已检测到的 Agent 与全部可选 target，提示显式传 `--target` |
| `uninstall` 未给 `--target` | 按"本工具包已安装 Skill"检测，1 个即卸载；0/多个同样报错并列出可选值 |
| `--target` 值非法 | 报错退出（exit 1）并列出合法 target |

检测信号只用文件系统（不执行外部命令）：Agent 自己的配置/Skill 根目录是否存在；`uninstall` 额外要求该 target 目录下确有本工具包的 Skill。`codex` 与 `codex-desktop` 共用 `~/.codex`，因此两者同时命中时会走"多命中报错"分支，由用户显式指定——这与"绝不静默装错 Agent"的设计决策一致。

## 5. dsh 的 MCP 注册说明

当前 main 上 `install --target dsh` 只做两件事：复制 Skill 到 `$DSH_HOME/skills`、打印通用 MCP 片段。写入 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 的自动注册由 #18 / PR #22 引入（`insert:` 语法、managed 注释块、按 entry id 幂等）。README 的 dsh 小节必须如实说明"当前需手动添加片段"并指向 #18/PR #22 的自动注册，待其合入后 rebase 时再把该句更新为"自动写入"。

## 6. doctor 与 update

README 每个 Agent 小节统一给出 `doctor / status / update / uninstall`。二者当前缺失，本 Issue 补齐：

- `doctor [--target <agent>]`：Node 版本、Skill 源、认证（AK/SK 环境变量或凭据文件，仅报告是否就绪，不打印任何凭据）、目标 Agent 的 Skill 与 MCP 配置就绪情况；必需项不满足时 exit 1。
- `update [--target <agent>]`：按当前运行版本刷新已安装 Skill（等价于重装技能部分）；省略 `--target` 时只刷新"已安装本工具包 Skill 的 Agent"（与 `uninstall` 同一检测口径），未安装任何 Agent 时报错退出且不落盘；升级到新版本通过 `npx --yes hdcommunity-toolkit@latest` 触发，命令输出中说明这一点。

## 7. 不在范围内

- 不实现 remote HTTP MCP server 传输（README 仅给出通用配置说明）。
- 不新增 target、不改 Skill 内容、不动 MCP 工具协议。
- 不重复实现 #19/#20/#21/#22 的行为（`--help` 守卫、opencode 卸载清理 MCP、dsh 自动注册、UPSTREAM_ERROR 详情）。

## 8. 验收标准

- [x] README 顶部列出全部 10 个内置 Agent 与 `all`
- [x] 每个 Agent 独立小节：install + 重启提醒 + `doctor / status / update / uninstall`
- [x] 省略 `--target` 的行为有文档且已实现（1 个自动、0 或多数报错并列出可选值）
- [x] dsh 小节写明 MCP 注册现状并关联 #18 / PR #22
- [x] `status` / `all` 覆盖 README 列出的全部 Agent（含 `codex-desktop`）
- [x] README 中每条命令/路径与 `src/setup-cli.mjs` 行为一致
- [x] `npm test`、`npm run smoke` 通过
