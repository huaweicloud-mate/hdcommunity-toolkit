# Spec — Issue #18 dsh 目标自动写入 MCP 配置

> 来源：Issue #18 正文 + VOD 收敛结论（issuecomment-6650832109）+ issue agent Spec（issuecomment-6650984534） | 优先级 P2 | 目标分支 main

## 1. 背景与目标

`install --target dsh` 目前只把 skills 写入 `~/.dsh/skills`，MCP server 配置仅打印手工模板，
需要用户手动编辑 `~/.dsh/profiles/<profile>/cordis.patch.yml`。手工 patch 对格式要求较高
（必须使用 `insert:` 键语法，裸 `- id:` 是对已有条目的定点覆盖，会告警 "patch: entry not found"），容易配错。

目标：像 opencode/codex 目标一样自动完成 dsh 的 MCP 注册，用户无需手工编辑 patch 文件。

## 2. 期望行为

安装时向 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`（默认 profile：`web`，可用 `DSH_PROFILE` 覆盖）追加：

```yaml
# hdcommunity-toolkit: managed MCP patch entry (id: mcp-hdcommunity) — removed by `hdcommunity-toolkit uninstall --target dsh`
- insert:
    - id: mcp-hdcommunity
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: hdcommunity
        transport: stdio
        command: npx
        args: ['-y', '-p', 'hdcommunity-toolkit', 'hdcommunity-toolkit-mcp']
        env:
          HDGROW_BASE: '<用户的 HDGROW_BASE>'
```

## 3. 范围

### In Scope
- `src/setup-cli.mjs`：dsh 目标 MCP 注册自动写入（追加 `insert:` 条目）与 uninstall 同步移除
- 写入前 `HDGROW_BASE` 显式校验（用户 env），缺失按 CONFIG_MISSING fail-fast，不写残缺配置
- 幂等：已存在 `id: mcp-hdcommunity` 条目（含用户手工添加）时不重复追加
- 新增 test 用例（纯函数 seam + CLI 端到端 seam）

### Out of Scope
- #16 uninstall 部分卸载问题的整体修复（仅保证本条目不残留）
- DSH patch 引擎自身行为改动
- 其他安装目标（opencode/codex 等）的变更
- 版本号/CHANGELOG（由后续 release 统一处理）

## 4. 验收标准
- [ ] DSH 0.2.1-rc.5（web profile）执行 `install --target dsh` 后，`cordis.patch.yml` 含上述 `insert:` 条目（`dump-config` 无告警对应：严格 `insert:` 键语法 + 正确缩进）
- [ ] `HDGROW_BASE` 缺失时安装按 CONFIG_MISSING 明确报错（exit code 1），不写入残缺配置、不落盘任何文件
- [ ] `uninstall --target dsh` 同步移除该条目；重复 install/uninstall 不产生重复或残留条目
- [ ] `doctor --target dsh` 显示 `MCP OK`；条目被删后显示 `MCP MISSING` 且退出码 1
- [ ] 所有现有测试通过，新增测试覆盖上述场景

## 5. 关键约束
- 零新增运行时依赖（patch 文本渲染/编辑自实现，不引入 YAML 解析库）
- `HDGROW_BASE` 判定不使用 `src/config.mjs growBase()` 内置测试网关默认值兜底——内置默认值属展示面兜底，固化进用户 patch 会把测试网关地址写死
- 写入采用受控文本手术：追加前跳过注释/空行与 `---` 文档分隔，取该文档首个实内容行判定——必须是 `- ` 序列项，否则拒绝追加并回退打印手工模板，防写坏用户 patch
