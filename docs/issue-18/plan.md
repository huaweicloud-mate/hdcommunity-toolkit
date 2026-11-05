# Plan — Issue #18 dsh 目标自动写入 MCP 配置

## 1. 设计决策（对齐 issue agent Spec 关键决策表）

| 决策 | 选择 | 理由 |
|------|------|------|
| 条目语法 | 严格 `insert:` 键语法 | 裸 `- id:` 是对已有条目的定点覆盖，会告警 "patch: entry not found" |
| profile 定位 | `$DSH_HOME/profiles/<profile>/cordis.patch.yml`，profile 默认 `web`、`DSH_PROFILE` 可覆盖 | DSH web UI 即 `~/.dsh/profiles/web/cordis.patch.yml`（Issue 实测环境）；与 `skillsDirFor('dsh')` 同样尊重 `DSH_HOME` |
| HDGROW_BASE 判定 | 安装期显式校验用户 env，缺失 fail-fast（CONFIG_MISSING，exit 1）；不用 growBase() 内置默认值兜底 | 内置默认值属展示面兜底，固化进用户 patch 会把测试网关地址写死 |
| 幂等策略 | 写入/移除前按 `id: mcp-hdcommunity` 检查条目级存在 | 防止重复 install 产生重复条目、uninstall 幂等 |
| 写入方式 | 纯文本手术（零新增依赖）：幂等检查→（文件存在且含托管块时）替换整块→否则尾部追加 | 避免引入 YAML 库；`env.HDGROW_BASE` 值可能含 YAML 特殊字符，一律单引号包裹并 `''` 转义 |
| 托管块识别 | 条目前一行注释标记 `hdcommunity-toolkit: managed MCP patch entry (id: mcp-hdcommunity)` | uninstall 精确移除"注释+条目"，不误删用户手工添加的同 id 条目（幂等检查按 id 扫描，移除按托管块） |
| 非法文件防护 | 文件存在且非 YAML sequence（首有效行非 `- ` / `---`）→ 拒绝追加，回退打印手工模板 | 防止把普通 mapping 文件写坏 |

## 2. 模块设计

### `src/dsh-patch.mjs`（新增，纯函数/文本手术）

```
const DSH_DEFAULT_PROFILE = 'web'
const DSH_PATCH_MANAGED_COMMENT = '# hdcommunity-toolkit: managed MCP patch entry (id: mcp-hdcommunity) — removed by `hdcommunity-toolkit uninstall --target dsh`'
const DSH_PATCH_ID = 'mcp-hdcommunity'

dshHome()            -> process.env.DSH_HOME || ~/.dsh            （与 skillsDirFor('dsh') 口径一致）
dshPatchFile()       -> join(dshHome(), 'profiles', <DSH_PROFILE|web>, 'cordis.patch.yml')
renderDshPatchEntry(base)      -> managed 块文本（注释 + insert: 条目，单引号转义）
findDshPatchEntry(text)        -> 该文件是否已存在 id: mcp-hdcommunity（幂等检查，含用户手工条目）
upsertDshPatch(file, base)     -> { action: 'created'|'updated'|'skipped'|'invalid' }
removeDshPatchEntry(file)      -> { removed: true|false }
dshPatchState(file?)           -> 'OK'|'MISSING'|'INVALID'（doctor 用）
```

### `src/setup-cli.mjs`（接线）
  ① const growBase = process.env.HDGROW_BASE（未设置/空 → console.error CONFIG_MISSING 指引 + process.exitCode=1，**在任何文件写入之前返回**：不落 skills、不写 patch）
  ② skills 落盘
  ③ upsertDshPatch(...)：created/updated 打印写入路径与 profile；skipped 提示已存在；invalid 回退 printGenericSnippet()

uninstall('dsh') 分支：
  ① 移除 skills（保持现状）
  ② removeDshPatchEntry(...)：removed 打印移除路径；否则静默（保持 uninstall 对其它目标"总是成功"的行为）
```

### 测试 seam（编码前协商）

| seam | 覆盖 |
|------|------|
| 纯函数 seam：`src/dsh-patch.mjs` 具名导出 `renderDshPatchEntry` / `findDshPatchEntry` / `upsertDshPatch` / `removeDshPatchEntry` / `dshPatchState` | 语法（`insert:` 键、id/name/config 字段、单引号转义）、幂等、无效文件拒绝、移除精确性 |
| CLI 端到端 seam：`bin/setup.cjs`（spawn）+ `HOME`/`DSH_HOME`/`HDGROW_BASE`/`DSH_PROFILE` 指向临时目录 | `install --target dsh` 写文件 / `HDGROW_BASE` 缺失 CONFIG_MISSING exit 1 且不落盘 / `uninstall --target dsh` 移除 / 重复 install 无重复 / `update --target dsh` 刷新 / `doctor --target dsh` MCP 状态 |

既有测试先例为 `node:test`（零新增依赖），沿用；纯函数直接由模块具名导出，不再需要 `NODE_ENV === 'test'` 条件下挂 `__internals` 的旁路（`setup-cli.mjs` 是入口脚本，import 即执行 `main()`）。

## 3. 任务拆解

| # | 任务 | 产出 |
|---|------|------|
| T1 | 失败测试（红） | test/setup-cli-dsh.test.mjs：渲染语法/幂等/移除/无效文件 + CLI install/uninstall/CONFIG_MISSING/doctor |
| T2 | 最小实现（绿） | src/dsh-patch.mjs（文本手术）+ src/setup-cli.mjs（install/uninstall/doctor 接线 + CONFIG_MISSING fail-fast） |
| T3 | 文档同步 | docs/issue-18/ 三件套；README 安装节补 dsh 自动注册说明 |
| T4 | 自审查 + PR | 5 轴审查 + 开源前置增量检查 → PR feat/issue-18 → main |

## 4. 审查修订（PR #22 首轮 QA 审查）

| 审查项 | 级别 | 处理 |
|--------|------|------|
| `copySkills` 先于 `HDGROW_BASE` 校验执行，CONFIG_MISSING 时 skills 仍落盘 | Required | 新增 `installDsh()`：先校验 `HDGROW_BASE`（缺失即 CONFIG_MISSING + exit 1 直接返回），通过后才 copySkills + 写 patch；测试补「skills 未写入」断言 |
| 非 sequence 检测只看首有效行，`---` 直接放行，`---\nmodel: gpt` 会被追加成非法混合文档 | Required | 跳过 `---`/注释/空行后取首个实内容行判定是否为 `- ` 序列项，否则 `invalid` 拒绝写入 |
| 托管块结束守卫排除 `start+1`，残留注释后紧跟的用户顶层 `- insert:` 会被一起删除 | Required | 守卫含 `start+1`；块内必须含 `id: mcp-hdcommunity` 才判定为本工具托管块，否则只移除残留注释行 |
| 托管块存在时命中 id 即 skipped，`HDGROW_BASE` 变更后重装不刷新 | Optional | `upsertDshPatch` 命中托管块时原地替换整块（内容相同才 skipped）；手工同 id 条目仍 skipped |
| `findDshPatchEntry` 不识别带引号 id、无缩进约束 | Optional | 正则兼容单/双引号 id，并限定 `- ` 前 0–8 空格缩进 |
| 测试断言路径 `join(DSH_HOME,'cordis.patch.yml')` 与实际路径不符（恒真） | Optional | 删除该断言，改为对 `DSH_HOME/skills` 的存在性断言 |

## 5. main 演进后的移植（rebase 到 v0.6.0）

PR #22 首轮审查（QA）通过后 main 连续合入 #21/#15/#20/#19/#17/#25/#24，分支与 main 冲突（CONFLICTING/DIRTY）。
按最新 main 重做移植，而不是机械 replay 9 个旧提交：

| main 侧变化 | 对本实现的影响 | 处理 |
|-------------|----------------|------|
| #23 引入 `SUPPORTED_TARGETS` / `detectTargets` / `resolveTarget` / `doctor` / `update`（`src/setup-cli.mjs` 重写） | dsh 分支原为硬编码 target 数组的 install/status 分支 | 保持 `SUPPORTED_TARGETS` 单一事实源不变，只在 `install()` 增加 `dsh` 前置分支；`uninstall()` 增加 dsh 托管条目清理；`doctor()` 增加 dsh MCP 状态 |
| #23 新增 `test/setup-cli.test.mjs`（与本分支同名文件 add/add 冲突） | dsh 用例无法与 main 用例并存于同一文件 | dsh 用例独立为 `test/setup-cli-dsh.test.mjs`；main 用例只补 `HDGROW_BASE` 前置条件（2 处） |
| `src/setup-cli.mjs` 是入口脚本（import 即执行 `main()`），`__internals` 旁路依赖 `NODE_ENV=test` | 纯函数 seam 脆弱 | 文本手术抽到 `src/dsh-patch.mjs` 具名导出，测试直接 import，无需环境变量旁路 |
| #25 移除成长中心能力（smoke 33 → 22 tools） | `HDGROW_BASE` 在本包内已无消费者（`src/config.mjs` 不再有 `growBase()`），但 Issue #18 验收要求 dsh 安装期校验并写入该 env | 保持 Issue 契约与 QA 已通过的行为不变（仍 fail-fast + 写入 env），README 明确该变量由 dsh 注册使用；是否需要放宽为可选留待后续 issue 决策 |
| `doctor` 原为"仅 OpenCode 自动校验 MCP" | dsh 变为自动注册后口径不一致 | `doctor` 增加 dsh 校验（`dshPatchState()`：OK/MISSING/INVALID），README 同步 |

提交策略（TDD 红/绿分提交，重写后）：
1. `test(#18): dsh MCP patch 写入/移除/幂等/CONFIG_MISSING 失败测试（红）`
2. `feat(#18): install --target dsh 自动写入 cordis.patch.yml MCP 注册`（含既有 installer 用例的 `HDGROW_BASE` 适配）
3. `docs(#18): 需求/方案/任务文档与 README 同步`
