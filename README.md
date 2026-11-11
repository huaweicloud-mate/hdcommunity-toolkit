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
| [DeepSeek Harness (DSH)](#deepseek-harness-dsh) | `dsh` | `$DSH_HOME/skills`（默认 `~/.dsh/skills`） | 自动写入 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`（profile 默认 `web`） |
| [Hermes](#hermes) | `hermes` | `~/.hermes/skills` | 安装后打印片段 |
| [OpenClaw](#openclaw) | `openclaw` | `~/.openclaw/skills` | 安装后打印片段 |
| [AtomCode](#atomcode) | `atomcode` | `~/.atomcode/skills` | 安装后打印片段 |

另有 `all`（逐个内置 Agent 安装）与 `generic`（复制 Skill 到 `~/.generic/skills` 并打印通用 MCP 片段）。未内置的 Agent 见 [Other Agents](#other-agents)。

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

`update` 省略 `--target` 时使用与 `uninstall` 相同的检测口径（只认已安装本工具包 Skill 的 Agent）：唯一命中即刷新该 Agent；未安装任何 Agent 时报错退出（exit 1），**不会**为仅存在配置目录、从未安装本工具包的 Agent 创建目录。

### 逐个 Agent 安装

每个小节给出 `install` / `doctor` / `status` / `update` / `uninstall` 全套命令。**安装后需重启会话**，MCP 工具与 Skill 才会被加载。

命令语义（各 Agent 通用）：

| 命令 | 作用 |
|---|---|
| `install --target <agent>` | 复制 Skill 到该 Agent 的 Skill 目录，并注册 MCP server（或打印片段） |
| `doctor [--target <agent>]` | 自检：Node 版本、Skill 源、AK/SK 是否就绪、目标 Agent 的 Skill 覆盖、MCP 配置状态；不打印任何凭据 |
| `status` | 列出全部内置 Agent 的安装状态与目录 |
| `update --target <agent>` | 按当前 CLI 版本刷新已复制 Skill（升级用 `@latest`）；省略 `--target` 时只刷新已安装的 Agent |
| `uninstall --target <agent>` | 移除该 Agent 下由本工具包复制的 Skill（OpenCode 额外清理 `opencode.json` 中的 MCP 条目，DSH 额外清理 `cordis.patch.yml` 中的托管条目） |

> `doctor` 的 MCP 检查范围：**OpenCode 与 DSH 自动校验**（OpenCode 读取 `opencode.json`/`opencode.jsonc` 的 `mcp.hdcommunity-toolkit`；DSH 读取 `cordis.patch.yml` 的 `id: mcp-hdcommunity` 条目，文件非 YAML sequence 时显示 `MCP INVALID`）；缺失即 `MCP MISSING`/`INVALID` 并使 `doctor` 失败。其余 Agent 固定显示 `MCP manual snippet`，表示需按安装时打印的片段手工注册，不影响 `doctor` 退出码。
>
> `doctor` 省略 `--target` 时只汇总已安装的 Agent 并检查运行环境（Node、Skill 源、认证），未安装任何 Agent 时打印提示但退出码仍为 0（环境本身无问题）；指定 `--target` 时该 Agent 未安装则 `doctor` 退出码为 1。

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

复制 Skill 到 `$DSH_HOME/skills`（未设置 `DSH_HOME` 时为 `~/.dsh/skills`），并把 MCP server 自动注册到 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`（profile 默认 `web`，可用 `DSH_PROFILE` 覆盖）。**重启会话**后生效。

```bash
npx --yes hdcommunity-toolkit doctor  --target dsh
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit update  --target dsh
npx --yes hdcommunity-toolkit uninstall --target dsh
```

> **MCP 自动注册**：DSH 从补丁层 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 组装配置，MCP 条目需用 `insert:` 语法写入。`install --target dsh` 自动写入该文件：
> - 按条目 `id: mcp-hdcommunity` 幂等，重复安装原地刷新托管条目，手工添加的同 id 条目不会被重复追加；
> - `uninstall --target dsh` 按托管注释标记精确移除该条目，保留用户其它 patch 内容；
> - 文件不是 YAML sequence（如普通 mapping 文档）时拒绝写入，改为打印手工片段。

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

逐个安装上表 10 个内置 Agent（`codex` 与 `codex-desktop` 共用 `~/.codex/skills`）。`update --target all` 只刷新已安装的 Agent（以 `status` 中 `installed` 为准），不会为未安装的 Agent 创建目录。

> `all` 包含 `dsh`，会自动完成 skills 复制与 MCP 注册，无需额外环境变量。

### Other Agents

未内置的 Agent 只要支持 MCP 即可接入：`install --target generic` 会复制 Skill 到 `~/.generic/skills` 并打印通用 MCP 片段（也可自行把 Skill 复制到该 Agent 的 Skill 目录）。

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

支持两种登录方式，由 `HDCOMMUNITY_AUTH_MODE` 控制（默认 `auto`：本地有 GitCode 会话就用它，否则回退 AK/SK）：

| 方式 | 适用 | 说明 |
|---|---|---|
| **GitCode 账号登录**（推荐） | 普通用户 | 调 `hdcommunity_auth_login`，打开后端授权页完成 GitCode 授权，回调换取社区会话 token 并缓存 |
| 华为云 **AK/SK** | CI / 服务间调用 | 请求头 `X-HW-AK` / `X-HW-SK` |

| 面 | 工具前缀 | 鉴权 |
|---|---|---|
| 登录 | `hdcommunity_auth_*` | GitCode 授权（`login` / `status` / `logout`） |
| 社区用户面 | `hdcommunity_blog_*` / `draft_*` / `comment_*` / `user_*` / `file_*` | `auto` 下优先 GitCode 会话（Bearer），否则 AK/SK |
| 公开只读 | `hdcommunity_show_*` | 无 |

- 会话 token 存储：`~/.config/hdcommunity-toolkit/auth.json`（权限 `0600`，仅存社区会话 token）。
- 无浏览器环境：需先配置 `HDCOMMUNITY_GITCODE_REDIRECT_URI`（后端允许的回调地址），再用 `hdcommunity_auth_login { wait: false }` 返回授权 URL，完成后把回调里的 `ticket` 传回 `hdcommunity_auth_login { ticket }`；未配置该地址时工具会直接报错，不会给出不可用的 URL。
- 跨机器登录：浏览器不在插件所在机器时用 `hdcommunity_auth_login { remote: true }`（或 `remote: true, wait: false` 先取 URL），把授权 URL/二维码交给用户打开；插件用后端返回的 `poll_key`（仅插件持有，不放进 URL）轮询 `hdcommunity_auth_poll`，不需要本地回环可达。
- 浏览器无法自动打开（如 Windows 下 `Start-Process` 失败）时不再静默等到超时：`hdcommunity_auth_login` 立即返回 `browser_opened: false` 与可直接打开的 `login_url`，用户手动打开该地址完成授权即可，票据仍由同一回环服务接收并自动保存会话（`login_url` 默认在 5 分钟内有效）；等待超时的错误信息同样带 `login_url`。
- AK/SK 读取优先级：环境变量 `HW_ACCESS_KEY`/`HW_SECRET_KEY` → `~/.config/huaweicloud/credentials.json` → `~/.hcloud/config.json`。可用 `doctor` 检查（只报告状态，不打印凭据）。

## 工具清单

### 登录（`hdcommunity_auth_*`）
`auth_login`（GitCode 授权登录）/ `auth_poll`（远程模式轮询）/ `auth_status`（登录状态）/ `auth_logout`（退出登录）。

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
| `HDCOMMUNITY_BASE` | `https://open-dataset.huaweicloud.com/api/v1/blogservice` | 社区服务地址（现网默认；其他环境显式指定完整 base，含 context-path） |
| `HDCOMMUNITY_AUTH_MODE` | `auto` | `auto`（GitCode 会话优先，回退 AK/SK）/ `gitcode` / `aksk` |
| `HDCOMMUNITY_AUTH_FILE` | `~/.config/hdcommunity-toolkit/auth.json` | 本地会话 token 存储路径（0600） |
| `HDCOMMUNITY_GITCODE_LOGIN_PATH` | `/agent/auth/gitcode/login` | 后端 GitCode 授权入口（相对 `HDCOMMUNITY_BASE`） |
| `HDCOMMUNITY_GITCODE_EXCHANGE_PATH` | `/agent/auth/gitcode/exchange` | 后端票据换会话 token 接口 |
| `HDCOMMUNITY_GITCODE_LOGOUT_PATH` | 空 | 可选：登出时服务端吊销接口；空则只清本地 |
| `HDCOMMUNITY_GITCODE_TICKET_PARAM` | `ticket` | 回调/交换参数名（回调里也兼容 `code`） |
| `HDCOMMUNITY_GITCODE_REDIRECT_URI` | 空 | 手动模式（无浏览器）使用的固定回调地址 |
| `HDCOMMUNITY_GITCODE_POLL_PATH` | `/agent/auth/gitcode/poll` | 远程模式（跨机器）轮询接口 |
| `HDCOMMUNITY_GITCODE_REMOTE_START_PATH` | `/agent/auth/gitcode/remote/start` | 远程模式发起接口（返回 login_url + poll_key） |
| `HDCOMMUNITY_LOGIN_TIMEOUT_MS` | `120000` | 等待授权回调的超时（毫秒） |
| `HDCOMMUNITY_LOGIN_URL_GRACE_MS` | `300000` | 浏览器未自动打开/等待超时后，返回的 `login_url` 仍可手动授权的时长（毫秒） |
| `HW_REGION` | `cn-north-4` | 区域 |
| `DSH_HOME` | `~/.dsh` | DSH 配置根目录（`install --target dsh` 读取） |
| `DSH_PROFILE` | `web` | DSH profile 名，决定 `cordis.patch.yml` 写入位置 |

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
