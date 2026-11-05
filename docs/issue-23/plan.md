# Plan: Issue #23 实现方案

## 1. 总体思路

先让脚本拥有 **target 单一事实源**，再让 README 从该事实源派生。这样 `--help`、`status`、`all`、省略 `--target` 的报错文案与 README 表格/小节永远同源，`codex-desktop` 这类漏项在结构上被消灭。

## 2. 脚本改造（`src/setup-cli.mjs`）

### 2.1 单一事实源

```js
const SUPPORTED_TARGETS = [
  'opencode', 'codex', 'codex-desktop', 'codearts', 'codearts-work',
  'workbuddy', 'dsh', 'hermes', 'openclaw', 'atomcode',
];
const ALL_TARGET_NAMES = [...SUPPORTED_TARGETS, 'all']; // 另加 generic
```

- `install('all')`、`status()` 改为遍历 `SUPPORTED_TARGETS`（原来手写数组漏了 `codex-desktop`）。
- `printHelp()` 的 target 行由常量拼接。

### 2.2 自动检测 `resolveTarget(args, mode)`

```
requested = args.target
  有值 → 归一化小写；all/generic/SUPPORTED_TARGETS 命中即返回；否则报错 + 列出可选值 (exit 1)
  无值 → detect(mode)
        mode='install'   : 检测各 Agent 根目录是否存在
        mode='uninstall' : 检测各 Agent 目录下是否已有本包 Skill
        命中 1 → 打印 [auto] detected agent: X，返回 X
        命中 0 → 报错 + 列出可选值 (exit 1)
        命中 >1 → 报错"拒绝猜测" + 已检测列表 + 可选值 (exit 1)
```

检测信号表（按 `skillsDirFor` 的父目录派生，不执行外部命令、不猜二进制名）：

| target | 检测根目录 |
|---|---|
| opencode | `~/.config/opencode` |
| codex / codex-desktop | `~/.codex` |
| codearts | `~/.codeartsdoer` |
| codearts-work | `~/.codeartswork` |
| workbuddy | `~/.workbuddy` |
| dsh | `$DSH_HOME`（默认 `~/.dsh`） |
| hermes / openclaw / atomcode | `~/.hermes` / `~/.openclaw` / `~/.atomcode` |

`codex` 与 `codex-desktop` 共用一个根目录，两者会同时命中 → 走多命中报错，提示显式指定。这是有意的"不猜"策略。

### 2.3 doctor / update

- `doctor [--target X]`：
  - Node >= 22（`engines`）；不满足 → exit 1
  - Skill 源目录存在且有 Skill；缺失 → exit 1
  - 认证：`HW_ACCESS_KEY`+`HW_SECRET_KEY` 环境变量对、或 `~/.config/huaweicloud/credentials.json`、或 `~/.hcloud/config.json` 存在——只报"已配置/未配置"，绝不读取或打印凭据内容
  - 指定 target 时：Skill 安装数 / 总数、opencode MCP 条目是否已注册；未安装 → exit 1
  - 未指定 target 时：汇总全部已安装的 target
- `update [--target X]`：复用 install 的 Skill 复制路径刷新已安装内容，输出提示"升级到新版本请用 `npx --yes hdcommunity-toolkit@latest update ...`"。

### 2.4 保持不变的契约

`install` / `uninstall` / `status` 的既有输出行（`[target] skills -> dir (N skills)`、`removed skills from`、`status` 的 `installed/-` 列）保持不变，避免与 #20/#21/#22 在同一区域产生无谓冲突。

## 3. README 结构（对齐 devkit）

```
# HDCommunity Toolkit（简介 + 一行支持列表）
## 支持的 Agent（表格：Agent / target / Skill 目录 / MCP 注册）
## Quick Start
   ### 安装到检测到的 Agent（省略 --target 的三条分支语义）
   ### 逐个 Agent 安装
       ### OpenCode / ### Codex / ### Codex Desktop / ### CodeArts Agent /
       ### CodeArts Work / ### WorkBuddy / ### DeepSeek Harness (DSH) /
       ### Hermes / ### OpenClaw / ### AtomCode
       （每节：install 命令 + 路径 + 重启提醒 + doctor/status/update/uninstall）
   ### 一次安装到全部 Agent
   ### Other Agents（通用 MCP 配置，含 remote HTTP 说明）
## 认证 / 工具清单 / 配置 / 内置 Skill / 开发 / 许可（原有内容保留）
```

## 4. 测试 seam

**公开 seam = CLI 进程边界**（`bin/setup.cjs` + argv + `HOME` 环境变量），不测内部函数：

- `spawnSync(process.execPath, [bin/setup.cjs, ...args], { env: { HOME: tmpdir } })`
- 断言 stdout / stderr / exit code，避免 mock `node:fs`，也让"路径写错"这类真实缺陷可被捕获。

用例清单：

1. `help` / `--help` 列出 10 个内置 target + `all` + 自动检测说明
2. 单 Agent 存在 + 省略 `--target` → 安装到该 Agent
3. 无 Agent + 省略 `--target` → exit 1 + 列出可选值
4. 多 Agent + 省略 `--target` → exit 1 + 拒绝猜测
5. `--target` 非法 → exit 1 + 列出可选值
6. `install --target <each>` → Skill 落到对应目录（含 `codex-desktop`）
7. `install --target all` → 10 个内置 target 均覆盖
8. `status` 列出全部 10 个 target，且安装状态正确
9. `uninstall` 自动检测单个已装 target → 移除 Skill；无已装 → exit 1
10. `doctor`：正常路径输出各检查项；`--target` 未安装 → exit 1；不打印凭据值
11. `update --target X` → 刷新被删除的 Skill

## 5. 风险

| 风险 | 处理 |
|---|---|
| 与 #20/#21/#22 在 `src/setup-cli.mjs` 冲突 | 只做常量抽取 + 新增函数，保留既有输出行；PR 说明合入顺序与 rebase 计划 |
| dsh 自动注册未合入导致 README 失实 | README 如实写"当前手动添加片段"，并指向 #18/PR #22；#22 合入后 rebase 时改为"自动写入" |
| 自动检测误判 | 只认文件系统信号，多命中一律报错，绝不猜测 |
| `codex`/`codex-desktop` 同目录导致频繁多命中 | 报错文案点明两者共用 `~/.codex`，给出显式指定命令 |