# Plan: Issue #15 实现方案

## 里程碑
- **M1（P1）**：install/uninstall 分支 `args.help` 守卫 + 三场景测试（含回归）

## 模块改动
| 模块 | 改动 |
|---|---|
| src/setup-cli.mjs | `main()` 的 `case 'install'` / `case 'uninstall'` 入口增加 `if (args.help) { printHelp(); return; }`；其余分支（status/help/undefined/default）逐一审查确认无同类遗漏 |
| test/setup-cli-help.test.mjs | 新增：子进程 spawn `bin/setup.cjs` 验证三场景——`install --help` 打印帮助且退出码 0 且无安装副作用（临时 HOME 下无文件/配置改写）、`uninstall --help` 同样、无位置参数 `--help` 行为不变（回归） |

## 关键决策
- **测试 seam**：CLI 是 import 即执行的脚本（`main()` 无 export、执行即跑），选择子进程 spawn（`node bin/setup.cjs …`）作为公开接口级 seam——直接测用户可见行为（stdout + 退出码 + 文件系统副作用），与 TDD 参考的"优先真实实现、测行为不测内部"一致
- **副作用隔离**：测试用 `mkdtemp` 临时目录注入 `HOME` 环境变量（`skillsDirFor` 基于 `homedir()`），install/uninstall 的真实副作用被限制在临时目录内；帮助场景断言临时 HOME 内无任何新增条目，证明无副作用
- **守卫位置**：switch 分支入口（方案 A），保持 `cmd` 映射逻辑（无位置参数时 `--help → help`）不变，回归风险最低
- **TDD 红/绿分提交**：先提交失败测试（证明契约），再提交最小实现使其通过

## 验证方式
- `npm test`（node --test）全部通过（含新增测试）
- 修复前新增测试必须为红（复现症状），修复后转绿
