# Spec: Issue #15 — install --help 不打印帮助，而是直接执行安装（存在副作用）

> 来源：Issue #15 评论 6650916586（issue agent 生成的权威 Spec），本文件为仓库内归档副本。

## Objective
- 要构建什么：修复 CLI 子命令帮助参数失效——`install --help` / `uninstall --help` 应打印帮助文本并以退出码 0 退出，不产生任何副作用
- 为什么：当前 `--help` 被忽略并直接执行真实安装，存在改写用户 agent 配置的副作用（P1，DX 与安全均受影响）
- 用户是谁：通过 `npx` 使用 hdcommunity-toolkit 的开发者与 Agent 工具链用户
- 成功标准：下方验收标准全部通过

## Scope

### In Scope
- `src/setup-cli.mjs` 的 `main()`：`case 'install'` / `case 'uninstall'` 分支入口增加 `args.help` 检查
- 帮助输出复用已有 `printHelp()`
- 三种场景的测试覆盖（install --help / uninstall --help / 无位置参数 --help 回归）

### Out of Scope
- `hdcommunity-mng-toolkit` 同源修复（已在 mng 仓另提 issue，仅关联跟踪）
- `parseArgs` 解析层改动（已识别 `--help` 并置 `args.help = true`，无需变更）
- 其他子命令（`--help` 行为正常，不动）

## Technical Approach

### 方案概述
在 `main()` 的 install/uninstall 分支入口处检查 `args.help`，命中则调用 `printHelp()` 并 `return`，确保子命令携带 `--help` 时只打印帮助、不执行安装/卸载。

### 实现路径
1. `src/setup-cli.mjs`：`case 'install':` 开头增加 `if (args.help) { printHelp(); return; }`；`case 'uninstall':` 同样处理
2. 对照 `main()` switch 全部分支逐一审查，确认其余子命令 help 行为无回归
3. 新增/更新测试：`install --help`、`uninstall --help` 打印帮助且退出码 0；无位置参数 `--help` 行为不变

### 关键设计决策
| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| help 守卫位置 | A. switch 分支入口检查；B. main() 顶部统一拦截 | A. 分支入口 | 与 VOD 收敛建议一致，改动最小、回归风险低，不影响既有 cmd 映射逻辑 |

## Affected Modules

| 模块 | 改动类型 | 说明 |
|------|---------|------|

| src/setup-cli.mjs | 修改 | install/uninstall 分支增加 args.help 守卫 |
| 测试用例 | 新增 | --help 三场景覆盖（含回归） |

## Acceptance Criteria
- [ ] `npx hdcommunity-toolkit install --help` 打印帮助文本，退出码 0，无任何安装副作用（文件/配置未被改写）
- [ ] `npx hdcommunity-toolkit uninstall --help` 打印帮助文本，退出码 0，无卸载副作用
- [ ] 无位置参数时 `--help` 行为保持不变（回归验证）
- [ ] 现有测试全部通过
- [ ] 新增测试覆盖新行为
