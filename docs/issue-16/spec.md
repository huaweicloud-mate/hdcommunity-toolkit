# Spec: Issue #16 — uninstall --target opencode 只移除 skills，MCP 配置残留（部分卸载）

> 来源：Issue #16 评论 6651016249（issue agent 生成的权威 Spec，Developability: ready），本文件为仓库内归档副本。

## Objective
- 修复 `uninstall --target opencode` 部分卸载：卸载与安装对称，同步清理 `~/.config/opencode/opencode.jsonc` 中由 `mergeOpencodeConfig` 写入的 MCP 条目（`hdcommunity-toolkit` / `hdcommunity-mng-toolkit`）
- 用户价值：避免卸载后 opencode 启动时反复拉起僵尸 MCP server（npx 每次解析下载且工具调用必然失败）
- 用户：使用 hdcommunity-toolkit 安装/卸载 CLI 的 opencode 用户
- 成功标准：install → uninstall 后 `opencode.jsonc` 的 `mcpServers` 不再含本工具包条目；卸载后启动不再拉起相关 MCP server

## Scope

### In Scope
- `src/setup-cli.mjs`：uninstall 的 opencode 分支补充 MCP 配置清理，与 `mergeOpencodeConfig` 写入对称
- 条目为工具写入的原始内容 → 删除；已被用户修改 → 保留并在卸载输出中提示残留配置路径
- 覆盖 mng 包 `hdcommunity-mng-toolkit` 条目的清理路径
- `test/` 新增 setup-cli install/uninstall 覆盖测试

### Out of Scope
- 其他 target（codex/codearts/dsh 等）行为变更（仅回归保护，不改逻辑）
- `opencode.jsonc` 中非本工具包写入的其他配置内容
- install 流程逻辑变更

## Technical Approach

### 方案概述
在 uninstall 的 opencode 分支复用 `mergeOpencodeConfig` 的配置读写约定，反向移除本工具包写入的 `mcpServers` 条目后回写文件。

### 实现路径
1. `src/setup-cli.mjs` 新增清理函数（命名对齐现有 `mergeOpencodeConfig` 风格）：读取 `opencode.jsonc`，定位 `mcpServers.hdcommunity-toolkit` / `hdcommunity-mng-toolkit`
2. 条目与安装写入的原始内容一致 → 删除并回写；无法确认（用户改写）→ 保留条目并在卸载输出中打印残留配置路径提示
3. `opencode.jsonc` 不存在或无相关条目 → 静默跳过（幂等）
4. `test/` 新增覆盖：install → uninstall 后条目清除；用户改写后条目保留并提示；mng 条目清理；install → uninstall → install 幂等

### 关键设计决策
| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| 用户修改过条目的处理 | 直接删除 / 保留并提示 | 保留并提示 | 避免覆盖用户自定义配置（对齐 Issue 期望行为） |
| 清理实现 | 重新实现 / 复用 mergeOpencodeConfig 读写 | 复用同一读写约定 | 保证写入与清理对称，减少格式漂移 |

## Affected Modules

| 模块 | 改动类型 | 说明 |
|------|---------|------|
| src/setup-cli.mjs | 修改 | uninstall opencode 分支新增 MCP 条目清理与提示输出 |
| test/（新增测试文件） | 新增 | setup-cli install/uninstall opencode 配置覆盖测试（当前无覆盖） |

### 依赖关系
setup-cli.mjs 的 uninstall ← 复用 install 侧 `mergeOpencodeConfig` 的配置读写约定；无新增外部依赖。

## Acceptance Criteria
- [ ] `install --target opencode` → `uninstall --target opencode` 后，`opencode.jsonc` 的 `mcpServers` 不含 `hdcommunity-toolkit`
- [ ] mng 包 `hdcommunity-mng-toolkit` 条目同路径可被清理
- [ ] 卸载后 opencode 启动不再自动拉起本工具包相关 MCP server
- [ ] 用户手动修改过条目的场景：条目保留且输出残留配置路径提示
- [ ] 回归：codex/codearts/dsh 等其余 target 卸载行为不受影响；install → uninstall → install 幂等
- [ ] 所有现有测试通过；新增测试覆盖上述场景

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| jsonc 回写丢失用户注释/格式 | Med | 复用 install 侧既有读写约定；按现状行为用测试固化，不做超范围增强 |
| 误删用户自定义条目 | High | 仅删除与安装写入内容匹配的条目；无法确认时保留并提示路径 |
| 影响其他 target | Med | 清理逻辑限定 opencode 分支；回归测试覆盖其余 target |

## Open Questions
- 无

## 开发基准
- 目标分支：main
