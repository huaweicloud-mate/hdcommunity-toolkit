# Plan — Issue #32

## 方案

改动收敛在入口解析层与 doctor 分支，下游 `install/uninstall/update/doctor` 不变。

### 1. `parseArgs`（src/setup-cli.mjs:413）

在独立 `--target` 分支前后并列增加等号形式分支：

```js
if (a === '--target') {
  ...既有逻辑...
} else if (a.startsWith('--target=')) {
  const value = a.slice('--target='.length);
  if (value === '') args.targetMissing = true;
  else args.target = value;
}
```

- 精确前缀 `--target=`，不吞 `--target-xxx` 等其他 flag；
- 空串 → `targetMissing`，与分离形式缺值同一路径；
- 值原样存 `args.target`，合法性校验仍由 `resolveTarget` 负责（大小写归一、`Unknown --target: <原值>` 输出保持原样）。

### 2. doctor 分支（src/setup-cli.mjs:481）

现状 `if (args.target !== undefined)`，空值（`targetMissing` 且 `target` 未定义）会跳过校验、静默跑默认全量检查。改为：

```js
if (args.target !== undefined || args.targetMissing) {
```

从而 `doctor --target=` 报 `Missing value for --target` 并退出 1；`doctor --target=no-such` 报 `Unknown --target: no-such`（该值本来就走 resolveTarget，只因解析缺失才被忽略）。

### 3. 测试 seam

复用既有 seam：`spawnSync(node, [bin/setup.cjs, ...args])` + `HOME` 指向临时沙盒目录，断言退出码 / stderr / 沙盒内技能目录副作用。不引入新的内部导出，不测 `parseArgs` 内部细节。

用例（加在 `test/setup-cli.test.mjs` 多 agent 段之后）：
- 等号形式非法值：`install --target=no-such` 报错且不落盘
- 等号形式合法值：`install --target=opencode` 正常安装
- 等号形式空值：四个命令均报 `Missing value for --target`
- `uninstall --target=opencode`（先分离形式安装）清干净
- `update --target=atomcode` 补齐被删技能
- `doctor --target=no-such` 退出 1 且不输出 `doctor: OK`

## TDD 顺序

1. 红：先提交上述测试，确认在当前实现下失败（等号形式被静默忽略）
2. 绿：改 `parseArgs` + doctor 分支，测试转绿
3. 回归：`npm run test` 全绿

## 风险

| 风险 | 缓解 |
|------|------|
| 前缀匹配误吞其他 `--target*` flag | 仅匹配 `--target=` 精确前缀 |
| 空值分支遗漏导致 doctor 静默 | 单测覆盖四命令空值 |
| 改变分离形式行为 | 分离分支逻辑不动，现有用例回归 |