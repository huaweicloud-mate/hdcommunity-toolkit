# Task — Issue #32

- [ ] T1（红）新增等号形式单测：`install --target=no-such` 报错、`install --target=opencode` 成功、`--target=` 缺失值、`uninstall/update/doctor` 等号形式等价 → 提交 `test(#32)`
- [ ] T2（绿）`parseArgs` 支持 `--target=<value>`（空值 → `targetMissing`）→ 提交 `fix(#32)`
- [ ] T3（绿）`doctor` 分支在 `targetMissing` 时走 `resolveTarget` → 同上或独立提交
- [ ] T4 全量回归 `npm run test`
- [ ] T5 自审查（5 轴 + 开源前置增量检查）→ push → 建 PR（base=main）
- [ ] T6 Issue 评论告知 + A2A 通知 QA