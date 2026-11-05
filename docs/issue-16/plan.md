# Plan: Issue #16 实现方案（uninstall opencode MCP 配置对称清理）

## 方案概述
uninstall 的 opencode 分支新增 `pruneOpencodeConfig()`：复用 `mergeOpencodeConfig` 的候选文件顺序（opencode.json → opencode.jsonc）与 `JSON.stringify(cfg, null, 2)` 回写约定，反向删除本工具包写入的 MCP 条目后回写；文件不存在/无条目静默跳过（幂等），用户改写过的条目保留并输出残留配置路径提示。

## 模块改动
| 模块 | 改动 |
|---|---|
| src/setup-cli.mjs | 抽出 `opencodeConfigCandidates()`（install/uninstall 共用候选顺序）；新增 `mcpServerEntryFor(pkg)`、`sameMcpEntry()`、`pruneOpencodeConfig()`、`printOpencodeCleanup()`；`uninstall()` 的 opencode 分支接入清理与提示输出（install 侧行为不变） |
| test/setup-cli.test.mjs | 新增：CLI 进程级覆盖测试（`spawnSync` + `HOME` 沙箱目录，断言真实配置文件与卸载输出） |

## 关键决策
- **清理键范围**：`mcp`（本工具 install 实际写入的键）+ `mcpServers`（Issue 报告口径/通用片段展示的键），两处都清理；只删与安装写入内容严格一致的条目。
- **清理包清单**：`hdcommunity-toolkit` + `hdcommunity-mng-toolkit`（mng 仓 setup-cli.mjs 与本仓同构，写入 entry 形状一致：`{type:'local', command:['npx','-y','-p',pkg,'${pkg}-mcp'], environment:{}, enabled:true}`）。
- **用户改写判定**：与安装写入 entry 做形状严格比较（键集合一致 + 数组逐位 + 对象 JSON 序列化比较）；一致 → 删除；不一致 → 保留 + 输出残留路径提示。宁保留不误删。
- **幂等与静默**：配置文件不存在 / 无相关条目 / 重复卸载 → 静默跳过不输出；仅在发生删除时回写文件；容器删空后移除空键。
- **非纯 JSON（含注释 jsonc）**：现状 install 对 parse 失败的文件本就不写入；uninstall 同口径不改动，仅提示人工检查残留，不做超范围增强。
- **测试 seam**：选最高 seam —— CLI 进程本身（`node src/setup-cli.mjs`，`HOME` 指向沙箱）。`homedir()` 在 POSIX 尊重 `$HOME`，无需为可测性改造生产代码；同时覆盖 bin 包装 → ESM 真实链路。
- **不做版本号/CHANGELOG 变更**：维护者以 chore 提交统一升版（对齐 0.4.1 惯例），本次仅代码 + 测试 + 文档归档。

## 测试计划（test/setup-cli.test.mjs，全部本地无网络）
1. install opencode → uninstall opencode：`mcp` 不含 `hdcommunity-toolkit`，用户其他配置键保留，输出含清理行（AC1/AC3）
2. 预置 mng 包 entry（同构形状）→ uninstall：`hdcommunity-mng-toolkit` 被清理（AC2，jsonc 文件变体）
3. 用户改写 entry（加 environment）→ uninstall：entry 保留 + 输出残留配置路径（AC4）
4. `mcpServers` 键下的工具写入 entry → uninstall 清理，无关 entry 不动（Issue 口径）
5. install → uninstall → install 幂等；二次 uninstall 静默无输出（AC5）
6. 无配置文件时 uninstall 正常退出且无 MCP 噪声输出（幂等/静默）
7. 回归：`--target codex` install/uninstall 行为不受影响（AC5）
