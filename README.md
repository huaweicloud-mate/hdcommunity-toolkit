# HDCommunity Toolkit

华为云社区业务的 **Agent 工具包** —— **用户面 + 展示面**（MCP 工具 + Skill），让 AI 编码助手以自然语言完成社区博客的**写/发/评论/互动**等操作。

> 本工具包只包含**普通用户**可看/可用的能力。

支持 10 个内置 Agent：**OpenCode、Codex CLI、Codex Desktop、CodeArts Agent、CodeArts Work、WorkBuddy、DeepSeek Harness (DSH)、Hermes、OpenClaw、AtomCode**。

**要求**：Node.js ≥ 22。

## 支持的 Agent

| Agent | `--target` | Skill 安装目录 | MCP 注册方式 |
|---|---|---|---|
| [OpenCode](#opencode) | `opencode` | `~/.config/opencode/skills` | 自动写入 `~/.config/opencode/opencode.json` |
| [Codex CLI](#codex-cli) | `codex` | `~/.codex/skills` | 安装后打印片段，加入 Codex MCP 配置 |
| [Codex Desktop](#codex-desktop) | `codex-desktop` | `~/.codex/skills` | 安装后打印片段，加入 Codex MCP 配置 |
| [CodeArts Agent](#codearts-agent) | `codearts` | `~/.codeartsdoer/skills` | 安装后打印片段，加入 CodeArts MCP 配置 |
| [CodeArts Work](#codearts-work) | `codearts-work` | `~/.codeartswork/skills` | 安装后打印片段 |
| [WorkBuddy](#workbuddy) | `workbuddy` | `~/.workbuddy/skills` | 安装后打印片段 |
| [DeepSeek Harness (DSH)](#deepseek-harness-dsh) | `dsh` | `$DSH_HOME/skills`（默认 `~/.dsh/skills`） | 安装后打印片段（自动注册见 [DSH](#deepseek-harness-dsh)） |
| [Hermes](#hermes) | `hermes` | `~/.hermes/skills` | 安装后打印片段 |
| [OpenClaw](#openclaw) | `openclaw` | `~/.openclaw/skills` | 安装后打印片段 |
| [AtomCode](#atomcode) | `atomcode` | `~/.atomcode/skills` | 安装后打印片段 |

另有 `all`（逐个内置 Agent 安装）与 `generic`（只打印通用 MCP 片段，Skill 落到 `~/.generic/skills`）。未内置的 Agent 见 [Other Agents](#other-agents)。

## Quick Start

### 省略 `--target`：自动检测

```bash
npx --yes hdcommunity-toolkit install
```

脚本按各 Agent 自身的配置目录（`~/.config/opencode`、`~/.codex`、`~/.codeartsdoer`、`~/.workbuddy`、`$DSH_HOME` 等）判断当前环境：

| 检测结果 | 行为 |
|---|---|
| 恰好 1 个 Agent | 直接安装到该 Agent，输出 `[auto] detected agent: <target>` |
| 0 个 | 报错退出（exit 1），列出全部可选 `--target`，**不会默认装到某个 Agent** |
| 多个 | 报错退出（exit 1），拒绝猜测，列出已检测到的 Agent 与全部可选值 |

> `codex` 与 `codex-desktop` 共用 `~/.codex`，两者会同时命中，此时按下表显式指定其一即可：`--target codex` 或 `--target codex-desktop`。

`uninstall` 也支持省略 `--target`：按"已安装本工具包 Skill 的 Agent"判断，同样只在唯一命中时执行，0 个或多个均报错并列出可选值。

### 逐个 Agent 安装

每个小节给出 `install` / `doctor` / `status` / `update` / `uninstall` 全套命令。**安装后需重启会话**，MCP 工具与 Skill 才会被加载。

命令语义（各 Agent 通用）：

| 命令 | 作用 |
|---|---|
| `install --target <agent>` | 复制 Skill 到该 Agent 的 Skill 目录，并注册 MCP server（或打印片段） |
| `doctor [--target <agent>]` | 自检：Node 版本、Skill 源、AK/SK 是否就绪、目标 Agent 的 Skill 与 MCP 配置；不打印任何凭据 |
| `status` | 列出全部内置 Agent 的安装状态与目录 |
| `update --target <agent>` | 按当前 CLI 版本刷新已复制 Skill（升级用 `@latest`） |
| `uninstall --target <agent>` | 移除该 Agent 下由本工具包复制的 Skill |

### OpenCode

```bash
npx --yes hdcommunity-toolkit install --target opencode
```

复制 Skill 到 `~/.config/opencode/skills`，并把 MCP server 自动写入 `~/.config/opencode/opencode.json`（`mcp.hdcommunity-toolkit`；已有配置不是合法 JSON 时改为打印片段）。**重启会话**后 MCP 工具生效。

```bash
npx --yes hdcommunity-toolkit doctor  --target opencode
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit update  --target opencode
npx --yes hdcommunity-toolkit uninstall --target opencode
```

### Codex CLI

```bash
npx --yes hdcommunity-toolkit install --target codex
```

复制 Skill 到 `~/.codex/skills`，并打印需要加入 Codex MCP 配置的 `mcpServers` 片段。**重启会话**后生效。

```bash
npx --yes hdcommunity-toolkit doctor  --target codex
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit update  --target codex
npx --yes hdcommunity-toolkit uninstall --target codex
```

### Codex Desktop

```bash
npx --yes hdcommunity-toolkit install --target codex-desktop
```

与 Codex CLI 共用 `~/.codex/skills`（Desktop 内置 Codex 运行时，`codex` 命令在 PATH 不可用时用这个 target）。同样打印 MCP 片段，**重启会话**后生效。

```bash
npx --yes hdcommunity-toolkit doctor  --target codex-desktop
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit update  --target codex-desktop
npx --yes hdcommunity-toolkit uninstall --target codex-desktop
```

### CodeArts Agent

```bash
npx --yes hdcommunity-toolkit install --target codearts
```

复制 Skill 到 `~/.codeartsdoer/skills`，并打印 MCP 片段（加入 CodeArts 的 MCP 配置）。**重启会话**后生效。

```bash
npx --yes hdcommunity-toolkit doctor  --target codearts
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit update  --target codearts
npx --yes hdcommunity-toolkit uninstall --target codearts
```

### CodeArts Work

```bash
npx --yes hdcommunity-toolkit install --target codearts-work
```

复制 Skill 到 `~/.codeartswork/skills`，并打印 MCP 片段。**重启会话**后生效。

```bash
npx --yes hdcommunity-toolkit doctor  --target codearts-work
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit update  --target codearts-work
npx --yes hdcommunity-toolkit uninstall --target codearts-work
```

### WorkBuddy

```bash
npx --yes hdcommunity-toolkit install --target workbuddy
```

复制 Skill 到 `~/.workbuddy/skills`，并打印 MCP 片段。**重启会话**后生效。

```bash
npx --yes hdcommunity-toolkit doctor  --target workbuddy
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit update  --target workbuddy
npx --yes hdcommunity-toolkit uninstall --target workbuddy
```

### DeepSeek Harness (DSH)

```bash
npx --yes hdcommunity-toolkit install --target dsh
```

复制 Skill 到 `$DSH_HOME/skills`（未设置 `DSH_HOME` 时为 `~/.dsh/skills`），并打印 MCP 片段。**重启会话**后生效。

```bash
npx --yes hdcommunity-toolkit doctor  --target dsh
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit update  --target dsh
npx --yes hdcommunity-toolkit uninstall --target dsh
```

> **MCP 自动注册**：DSH 从补丁层 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 组装配置，MCP 条目需用 `insert:` 语法写入。`install --target dsh` 自动写入该文件（按 entry id 幂等、只在托管注释块内增删）由 **#18 / PR #22** 跟进；在该能力合入前，请把上面打印的片段手工加入此补丁文件。合入后本节将改为"安装即自动注册"，无需手工编辑。

### Hermes

```bash
npx --yes hdcommunity-toolkit install --target hermes
```

复制 Skill 到 `~/.hermes/skills`，并打印 MCP 片段。**重启会话**后生效。

```bash
npx --yes hdcommunity-toolkit doctor  --target hermes
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit update  --target hermes
npx --yes hdcommunity-toolkit uninstall --target hermes
```

### OpenClaw

```bash
npx --yes hdcommunity-toolkit install --target openclaw
```

复制 Skill 到 `~/.openclaw/skills`，并打印 MCP 片段。**重启会话**后生效。

```bash
npx --yes hdcommunity-toolkit doctor  --target openclaw
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit update  --target openclaw
npx --yes hdcommunity-toolkit uninstall --target openclaw
```

### AtomCode

```bash
npx --yes hdcommunity-toolkit install --target atomcode
```

复制 Skill 到 `~/.atomcode/skills`，并打印 MCP 片段。**重启会话**后生效。

```bash
npx --yes hdcommunity-toolkit doctor  --target atomcode
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit update  --target atomcode
npx --yes hdcommunity-toolkit uninstall --target atomcode
```

### 一次安装到全部 Agent

```bash
npx --yes hdcommunity-toolkit install --target all
```

逐个安装上表 10 个内置 Agent（`codex` 与 `codex-desktop` 共用 `~/.codex/skills`）。`update --target all` 会刷新全部已安装 Agent。

### Other Agents

未内置的 Agent 只要支持 MCP 即可接入：`install --target generic` 打印通用片段，Skill 落到 `~/.generic/skills`（也可自行复制到该 Agent 的 Skill 目录）。

```bash
npx --yes hdcommunity-toolkit install --target generic
```

```json
{
  "mcpServers": {
    "hdcommunity-toolkit": {
      "command": "npx",
      "args": ["-y", "-p", "hdcommunity-toolkit", "hdcommunity-toolkit-mcp"]
    }
  }
}
```

OpenCode 风格的 `mcp` 键等价写法（也是 `install --target opencode` 写入的条目）：

```json
{
  "mcp": {
    "hdcommunity-toolkit": {
      "type": "local",
      "command": ["npx", "-y", "-p", "hdcommunity-toolkit", "hdcommunity-toolkit-mcp"],
      "enabled": true
    }
  }
}
```

> **关于 remote HTTP**：本工具包只提供 **stdio** MCP server，不提供 HTTP/SSE 端点。若目标 Agent 只支持 HTTP 接入，需要在前方自行加一层 stdio→HTTP 代理，`command`/`args` 仍与上面一致，工具协议不变。配置完成后**重启会话**。

## 认证

| 面 | 工具前缀 | 鉴权 |
|---|---|---|
| 社区用户面 | `hdcommunity_blog_*` / `draft_*` / `comment_*` / `user_*` / `file_*` | 华为云 **AK/SK**（`HW_ACCESS_KEY`/`HW_SECRET_KEY`） |
| 公开只读 | `hdcommunity_show_*` | 无 |

AK/SK 读取优先级：环境变量 `HW_ACCESS_KEY`/`HW_SECRET_KEY` → `~/.config/huaweicloud/credentials.json` → `~/.hcloud/config.json`。安装后可用 `doctor` 确认是否就绪（只报告状态，不打印凭据）。

## 工具清单

### 社区用户面（`hdcommunity_*`）
博客：`blog_list` / `blog_detail` / `blog_create` / `blog_update` / `blog_delete` / `blog_mine` / `blog_favorites`；
草稿：`draft_list` / `draft_save` / `draft_delete`；
评论：`comment_list` / `comment_add` / `comment_edit` / `comment_delete`；
互动：`blog_vote` / `blog_favorite` / `blog_follow`；
用户：`user_profile` / `user_stat`；文件：`file_upload`。

### 公开只读（`hdcommunity_show_*`）
`show_blog_list` / `show_blog_detail`。

## 配置（环境变量）

| 变量 | 默认 | 说明 |
|---|---|---|
| `HDCOMMUNITY_BASE` | `https://opentest-dataset.huaweicloud.com/api/v1/blogservice` | 社区服务地址 |
| `HW_REGION` | `cn-north-4` | 区域 |
| `DSH_HOME` | `~/.dsh` | DSH 配置根目录（`install --target dsh` 读取） |

## 内置 Skill

| Skill | 用途 |
|---|---|
| `hd-blog-author` | 开发者「写 → 发 → 查审核 → 看数据」 |
| `hd-blog-promote` | 博客 → 各平台推广文案 |
| `hd-experience` | 体验案例上报 |

## 开发

```bash
npm install
npm run smoke   # 协议层冒烟（无需网络）
node --test     # 单元测试（含安装器 CLI 黑盒测试）
npm start       # 启动 MCP server（stdio）
```

## 许可

Apache-2.0