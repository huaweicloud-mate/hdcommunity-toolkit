# Spec — Issue #32：`--target=<value>` 等号形式静默忽略无效值

## 背景

`src/setup-cli.mjs` 的 `parseArgs` 只识别独立的 `--target` token（`a === '--target'`）。
`--target=no-such` 整串落入位置参数 `args._`，`args.target` 保持 `undefined`，
`resolveTarget` 因此走自动检测分支：

- 单 agent 环境 → `[auto] detected agent: <agent>`，按检测结果安装，**非法值被静默忽略**；
- 多 agent / 无 agent 环境 → 被 `refusing to guess` 掩盖，用户看不到真实原因。

分离形式 `--target no-such` 的行为是正确的（`Unknown --target: no-such` + 非 0 退出）。

## 目标

让 `--target=<value>` 与 `--target <value>` 在合法 / 非法 / 空值三种情形下行为完全一致：

| 输入 | 期望 |
|------|------|
| `install --target=no-such` | stderr `Unknown --target: no-such` + 合法目标列表，退出码 1，不执行安装 |
| `install --target=opencode` | 与分离形式一致，安装到 `~/.config/opencode/skills`，退出码 0 |
| `install --target=` | stderr `Missing value for --target` + 列表，退出码 1，不执行安装 |
| `uninstall/update/doctor --target=<值>` | 同上语义（doctor 非法值须报 Unknown，而不是跑默认全量检查） |

## 范围

In scope：
- `parseArgs` 支持 `--target=<value>`，空值置 `targetMissing`
- `doctor` 分支在 `targetMissing` 时也走 `resolveTarget` 校验（否则空值仍被静默忽略）
- `test/setup-cli.test.mjs` 新增等号形式单测（非法 / 合法 / 空值，覆盖四命令）

Out of scope：
- 自动检测逻辑本身
- 分离形式 `--target <value>` 的行为
- 新增 target 类型 / 帮助文本格式

## 验收标准

- [ ] `install --target=no-such` 报 `Unknown --target: no-such` 与合法列表，退出码非 0，无安装副作用
- [ ] `install --target=opencode` 正常安装
- [ ] `install --target=` 报 `Missing value for --target`
- [ ] `uninstall` / `update` / `doctor` 等号形式同样生效（含空值、非法值）
- [ ] 现有测试全绿（`npm run test`）

优先级 P2（参数边界 UX，不影响显式合法值行为）。