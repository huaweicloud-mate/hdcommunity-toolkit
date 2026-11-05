# Plan — Issue #26 默认后端域名切换为现网 open-dataset

## 1. 方案概述

单点常量替换 + 文档示例占位符化，`HDCOMMUNITY_BASE` 覆盖结构不动。运行时链路
`config.mjs → http-client.buildUrl → request()` 无需任何改动，只换兜底值来源内容。

## 2. 实现路径

1. `src/config.mjs:5`：兜底常量 → `https://open-dataset.huaweicloud.com/api/v1/blogservice`
2. `README.md` 配置表 `HDCOMMUNITY_BASE` 默认列 → 现网地址
3. `skills/hd-blog-author/SKILL.md:21/46`：示例域名 → `<backend-base>`，并补充"实际值 = 工具箱配置的
   `HDCOMMUNITY_BASE`，未配置时为现网默认地址"
4. `test/config.test.mjs`：默认值 + 覆盖行为（含空串回退默认）
5. `test/docs-config.test.mjs`：README/SKILL.md 文档一致性回归（无 `opentest-dataset`、示例用占位符、
   README 默认值与代码默认值一致）

## 3. 测试 seam

| 切片 | seam | 理由 |
|---|---|---|
| 默认值/覆盖 | **进程级**：`spawnSync(node, ['--input-type=module','-e', "import config.mjs 后打印 BACKEND_BASE"])`，分别注入/清空 `HDCOMMUNITY_BASE` | `config.mjs` 在模块加载时读 env，进程级最能代表真实用户路径（安装后 env 生效）；同时天然规避 ESM 模块缓存，不需要 query-busting 技巧 |
| 文档一致性 | 文件内容断言（`readFileSync`），正则取 README 表格行 | 直接编码"无残留默认表述"验收项，防文档漂移回归 |

复用现有约定：`node --test`（`npm test`）、`node:test` + `assert/strict`、无网络、无新依赖。

## 4. 关键设计决策

| 决策 | 选项 | 选择 | 理由 |
|---|---|---|---|
| 文档示例写法 | 写死域名 / 占位符 | `<backend-base>` 占位符 | 默认值再变更时文档不漂移（Spec 决策） |
| 测试环境支持方式 | 新增开关 / 保留 `HDCOMMUNITY_BASE` | 保留环境变量覆盖 | 零侵入、向后兼容 |
| 默认值断言方式 | 直接 import 模块读常量 / 子进程读 | 子进程 | 模块加载即固化 env，同进程无法同时测默认与覆盖；子进程还原真实使用场景 |

## 5. 兼容性 / 风险

- 显式配置用户零影响；未配置用户由测试环境 → 现网，即本 Issue 期望行为。
- 文档中的 `docs/hdcommunity-toolkit-实现规格*.md` 历史规格含旧地址示例（`127.0.0.1:8080` 本地开发示例），
  属历史存档且非默认表述，本次不改，避免扩大范围。
- 无依赖变更，无 CI 配置变更。

## 6. 提交策略（TDD 红/绿）

1. `test(#26): 默认后端域名为现网 + HDCOMMUNITY_BASE 覆盖 + 文档无残留 —— 失败测试（红）`
2. `fix(#26): BACKEND_BASE 兜底值切换为现网 open-dataset`
3. `docs(#26): README 配置表 / hd-blog-author 示例改用 <backend-base> 占位符 + issue-26 文档`