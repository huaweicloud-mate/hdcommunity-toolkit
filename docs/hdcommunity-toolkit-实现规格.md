# HDCommunityToolkit 实现规格 / 接口契约（评审稿 v1.2）

> 日期：2026-10-19 ｜ 目的：把设计方案的「战略层」落到「施工图」
> 参考：Toolkit 骨架 `C:\project\huaweicloud-devkit\huaweicloud-devkit`；AK/SK 后端处理 `C:\project\huaweicloud-devkit\hdopenservice`；业务代码 `C:\project\huaweicommunity-devkit\hdblogservice`

> **⚠️ 本迭代范围**：**只做端侧 `hdcommunity-toolkit` 包**（§1 Toolkit 主体 / §2 MCP / §3 Skill）。
> **后端（§4 hdblogservice）本迭代不实现**——其接口契约（§4.3/§4.4）保留，作为**后续迭代**的实现依据与 toolkit 对接约定。
> **v1.2 变更**：后端用户面与管理面**已合并为单一服务**（`hdblogservice`，端口 8080，管理面挂 `/manage/**`），原 §4/§5 合并为 §4。

---

## 0. 总述（总体实现方案）

### 0.1 目标与范围

一个独立发布的 Agent 工具包 `hdcommunity-toolkit`（Node.js），向 opencode/codex/码道等 Agent 提供**华为云社区业务**的 MCP 工具 + Skill。首批接入博客（用户面 + 管理面 + 对外只读），后续成长体系/大赛/活动按同一框架接入。

**本迭代交付 —— 端侧 `hdcommunity-toolkit` 包：**
- 工具包壳（MCP server + Skill + 安装器 + 凭证读取 + HTTP 调用层）
- 三组 MCP 工具定义（用户面 / 管理面 / 数据展示面，含 inputSchema）
- 4 个 Skill

**后续迭代（本迭代不实现，契约见 §4）：**
- 后端 hdblogservice（用户面 + 管理面，**已合并为单服务**）的 `/agent/blog/*`、`/agent/admin/*`、`/agent/show/*` 聚合接口 + 认证/权限
- 成长积分对接（§4.7）
- 体验官上报接口对接（§3.4，待对方提供）

### 0.2 系统全景

```
┌─ Agent (opencode / codex / 码道) ──────────────────────────┐
│   本地进程 hdcommunity-toolkit-mcp（Node ESM）              │
│   ├─ 会话态：管理面 token 缓存（sessionId → token）          │
│   ├─ 凭证源：~/.config/huaweicloud/credentials.json (AK/SK) │
│   └─ 工具层：undici HTTP → 后端 /agent/* 与 /manage/*        │
└────────────────────────────────────────────────────────────┘
      │ 用户面：X-HW-AK/X-HW-SK(+X-HW-Security-Token) 逐请求携带
      │ 管理面：Authorization: Bearer <token>
      ▼
┌──────────────────────────────────────────────────────────────┐
│ hdblogservice (8080)  context-path /api/v1/blogservice        │
│  用户面：/blog/* /comment/* /draft/* /user/* /file/*           │
│         + AgentAuthFilter(AK/SK) + /agent/blog/* /agent/show/* │
│  管理面：/manage/*（auth/blog/comment/stats）                  │
│         + 内部登录拦截器(沿用) + /agent/admin/*                 │
│  聚合接口 → 现有 Service（同进程复用）                          │
└──────────────────────────────────────────────────────────────┘
      │
      ▼
  MySQL huaweicloud_blog（表前缀 hd_blog_，Flyway history flyway_schema_history_blog）
  Redis
```

### 0.3 技术栈定稿

| 组件 | 技术栈 | 依据 |
|---|---|---|
| Toolkit（MCP server + 安装器） | **Node.js ≥ 22，ESM（`.mjs`）** | 与 `huaweicloud-devkit` 完全一致，可直接照搬骨架 |
| Toolkit HTTP 客户端 | `undici`（唯一运行时依赖） | 同 devkit |
| 后端（用户面 + 管理面，**单服务**） | Spring Boot 3.3.5 / **Java 17** / MyBatis-Plus 3.5.9 / Redis / Flyway | 现有 `hdblogservice` `pom.xml` |
| 后端认证实现（**后续迭代**） | **直接 copy `hdopenservice` 的 3 个类**（用户面 AK/SK），**不加 Maven 模块** | 见 §4.1 |

### 0.4 命名约定（定稿）

| 维度 | 规范 | 示例 |
|---|---|---|
| npm 包名 | `hdcommunity-toolkit` | — |
| CLI bin | `hdcommunity-toolkit` | `npx hdcommunity-toolkit install` |
| MCP bin | `hdcommunity-toolkit-mcp` | `npx hdcommunity-toolkit-mcp` |
| MCP 工具名 | `hdcommunity_<面>_<动作>` | `hdcommunity_blog_create` |
| Skill 目录 | `skills/hd-<用途>/SKILL.md` | `skills/hd-blog-author/` |
| 后端 Agent 接口 | `/agent/<面>/*`（context-path 之内） | `/api/v1/blogservice/agent/blog/list` |
| 数据表 | 新表前缀 `hd_community_*`；现有表沿用 `hd_blog_*` | `hd_community_operator` |

> **MCP 工具名前缀保持 `hdcommunity_`**（已定）。

### 0.5 模块分层与交付物

**本迭代交付：**

| 层 | 交付物 | 位置 |
|---|---|---|
| Toolkit 主体 | MCP server 框架 + 安装器 | `hdcommunity-toolkit/`（Node 包） |
| MCP 工具 | 三组工具定义 + HTTP 客户端 + 会话态 | 包内 `src/tools/` |
| Skill | 4 个 skill | 包内 `skills/` |

**后续迭代交付（不在本次）：** 后端 `hdblogservice`（单服务：用户面 + 管理面）改造（§4）。

### 0.6 与 `huaweicloud-devkit` 的关系（复用边界）

**照搬（结构/代码模式）**：`mcp-server.mjs`、`mcp-protocol.mjs`（dispatch/tools 分发）、`tools.mjs`（TOOL_DEFINITIONS 结构）、`bin/setup.cjs`（安装器）、`.mcp.json`、多 agent manifest 机制。

**复用（数据格式，不依赖内部代码）**：读取 `~/.config/huaweicloud/credentials.json`（S1 vault，格式 `{ak, sk, securityToken}`）作为 AK/SK 来源——**只复用文件格式，不 `import` devkit 内部模块**。

**不依赖**：不 `import huaweicloud-devkit` 的任何内部 `.mjs`（devkit 未对外导出 auth 模块，强耦合会导致版本冲突）。Toolkit 自带一份精简的凭证读取。

---

## 1. Toolkit 主体框架（参考 huaweicloud-devkit）

### 1.1 目录结构（已实现）

```
hdcommunity-toolkit/
├─ package.json / plugin.json / mcp.json / .mcp.json
├─ .claude-plugin/ .codex-plugin/plugin.json
├─ bin/setup.cjs
├─ src/
│  ├─ mcp-server.mjs        # MCP 进程入口（stdio）
│  ├─ mcp-protocol.mjs      # dispatch：initialize / tools/list / tools/call
│  ├─ version.mjs
│  ├─ config.mjs            # 后端地址 / 区域 / 超时
│  ├─ credentials.mjs       # AK/SK 读取（env → vault → KooCLI）
│  ├─ session.mjs           # 管理面 token 会话缓存
│  ├─ errors.mjs            # 结果/错误映射
│  ├─ setup-cli.mjs         # 安装器
│  └─ tools/
│     ├─ index.mjs          # TOOL_DEFINITIONS 汇总
│     ├─ blog-tools.mjs     # 用户面
│     ├─ admin-tools.mjs    # 管理面
│     ├─ show-tools.mjs     # 数据展示面
│     └─ http-client.mjs    # undici 封装 + 认证头注入 + 错误映射
├─ skills/                  # 4 个 skill
└─ scripts/smoke.mjs
```

### 1.2 package.json 契约（已实现）

```json
{
  "name": "hdcommunity-toolkit",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "hdcommunity-toolkit": "./bin/setup.cjs",
    "hdcommunity-toolkit-mcp": "./src/mcp-server.mjs"
  },
  "dependencies": { "undici": "^8.11.2" },
  "engines": { "node": ">=22" }
}
```

### 1.3 进程入口

- `--transport stdio`（默认）：JSON-RPC over stdio，支持 `Content-Length` 分帧与 `\n` 分帧。
- `--transport remote`：Streamable HTTP（规划中，M0 未实现）。
- `initialize` → `tools/list` → `tools/call`；`sessionId`：stdio 固定 `'stdin'`。

### 1.4 凭证来源（`src/credentials.mjs`）

按优先级读取 AK/SK（**不依赖 devkit 代码**）：

1. 环境变量 `HW_ACCESS_KEY` / `HW_SECRET_KEY` / `HW_SECURITY_TOKEN`
2. `~/.config/huaweicloud/credentials.json`（devkit S1 vault）
3. `~/.hcloud/config.json`（KooCLI profile）

导出 `loadCredentials()` → `{ ak, sk, securityToken, region, projectId }`。

### 1.5 安装器（`bin/setup.cjs` → `src/setup-cli.mjs`）

命令：`install / uninstall / status / help`。
目标 agent：`opencode, codex, codex-desktop, codearts, codearts-work, workbuddy, dsh, hermes, openclaw, atomcode, all`。
动作：copy skills 到各 agent skills 目录 + 写 MCP 配置（opencode 合并 `opencode.json`；其余打印通用 snippet）。

### 1.6 配置（`src/config.mjs`）

```js
// 单一后端（用户面 + 管理面合并），context-path /api/v1/blogservice
export const BACKEND_BASE = process.env.HDCOMMUNITY_BASE || 'http://127.0.0.1:8080/api/v1/blogservice';
// 管理面为真实接口（可直接对接现有后端）
export const ADMIN_LOGIN_PATH  = process.env.HDCOMMUNITY_ADMIN_LOGIN_PATH  || '/manage/auth/login';
export const ADMIN_LOGOUT_PATH = process.env.HDCOMMUNITY_ADMIN_LOGOUT_PATH || '/manage/auth/logout';
export const REGION = process.env.HW_REGION || 'cn-north-4';
export const DEFAULT_TIMEOUT_MS = Number(process.env.HDCOMMUNITY_TIMEOUT_MS || 30000);
```

---

## 2. MCP 设计

### 2.1 协议层（照抄 devkit `mcp-protocol.mjs`）

```
dispatch('initialize', params, {sessionId})         → serverInfo
dispatch('tools/list')                               → { tools: TOOL_DEFINITIONS }
dispatch('tools/call', {name, arguments}, {sessionId})
   ├─ 校验 inputSchema.required
   ├─ callTool(name, args, {sessionId})              # 注入 sessionId 供管理面 token 用
   └─ 返回 {content:[{type:'text', text: JSON.stringify(result, null, 2)}], isError}
dispatch(unknown)                                    → -32601 / -32602
```

### 2.2 工具命名与分组（定稿）

| 组 | 前缀 | 认证 | 后端 |
|---|---|---|---|
| 用户面 | `hdcommunity_blog_*` / `draft_*` / `comment_*` / `user_*` / `file_*` | 每次请求带 AK/SK | hdblogservice `/agent/blog/*` |
| 管理面 | `hdcommunity_admin_*`（含 `admin_login`） | Bearer token（内部登录） | hdblogservice `/agent/admin/*` |
| 数据展示面 | `hdcommunity_show_*` | 无（公开只读） | hdblogservice `/agent/show/*` |

### 2.3 完整工具清单（含 inputSchema）

> 参数命名统一 `snake_case`（对齐后端 JSON）。**共 35 个工具**（用户面 20 + 管理面 13 + 展示面 2）。

#### 2.3.1 用户面（20 个）

| 工具名 | 后端接口 | inputSchema |
|---|---|---|
| `hdcommunity_blog_list` | GET /agent/blog/list | `page_no` `page_size` `key_word` `type` |
| `hdcommunity_blog_detail` | GET /agent/blog/detail | `ref`(必) `log_view` |
| `hdcommunity_blog_create` | POST /agent/blog/save | `title`(必) `content`(必) `intro` `cover_url` |
| `hdcommunity_blog_update` | POST /agent/blog/save | `ref`(必) `title` `content` `intro` `cover_url` |
| `hdcommunity_blog_delete` | DELETE /agent/blog/{ref} | `ref`(必) |
| `hdcommunity_blog_mine` | GET /agent/blog/mine | `status` `page_no` `page_size` |
| `hdcommunity_blog_favorites` | GET /agent/blog/favorites | `page_no` `page_size` |
| `hdcommunity_draft_list` | GET /agent/blog/draft/list | 无 |
| `hdcommunity_draft_save` | POST /agent/blog/draft/save | `draft_id` `title` `content`(必) |
| `hdcommunity_draft_delete` | DELETE /agent/blog/draft/{draft_id} | `draft_id`(必) |
| `hdcommunity_comment_list` | GET /agent/blog/comment/list | `id`(必) `level` `page_no` `page_size` |
| `hdcommunity_comment_add` | POST /agent/blog/comment/add | `blog_ref`(必) `content`(必) `parent_id` |
| `hdcommunity_comment_edit` | POST /agent/blog/comment/edit | `comment_id`(必) `content`(必) |
| `hdcommunity_comment_delete` | DELETE /agent/blog/comment/{comment_id} | `comment_id`(必) |
| `hdcommunity_blog_vote` | POST /agent/blog/vote | `ref`(必) `operation_type`(必 1/0) |
| `hdcommunity_blog_favorite` | POST /agent/blog/favorite | `ref`(必) `operation_type`(必 1/0) |
| `hdcommunity_blog_follow` | POST /agent/blog/follow | `author_uid`(必) `operation_type`(必 1/0) |
| `hdcommunity_user_profile` | GET /agent/blog/user/profile | 无 |
| `hdcommunity_user_stat` | GET /agent/blog/user/stat | 无 |
| `hdcommunity_file_upload` | POST /agent/blog/file/upload | `name`(必) `content_base64`(必) |

#### 2.3.2 管理面（13 个，含独立登录）

| 工具名 | 后端接口 | inputSchema |
|---|---|---|
| `hdcommunity_admin_login` | POST **/manage/auth/login** | `username`(必) `password`(必) |
| `hdcommunity_admin_logout` | POST **/manage/auth/logout** | `token`（可选，缺省用会话缓存） |
| `hdcommunity_admin_blog_page` | GET /agent/admin/blog/page | `page_no` `page_size` `status` `online` `keyword` |
| `hdcommunity_admin_blog_review` | POST /agent/admin/blog/review | `id`(必) `action`(必 approve\|reject) `remark` |
| `hdcommunity_admin_blog_review_batch` | POST /agent/admin/blog/review/batch | `ids`(必) `action`(必) `remark` |
| `hdcommunity_admin_blog_online` | POST /agent/admin/blog/online | `id`(必) `online`(必 0\|1) |
| `hdcommunity_admin_blog_top` | POST /agent/admin/blog/top | `id`(必) `top`(必 0\|1) |
| `hdcommunity_admin_blog_records` | GET /agent/admin/blog/{id}/records | `id`(必) `page_no` `page_size` |
| `hdcommunity_admin_comment_page` | GET /agent/admin/comment/page | `page_no` `page_size` `status` `online` `keyword` |
| `hdcommunity_admin_comment_review` | POST /agent/admin/comment/review | `id`(必) `action`(必) `remark` |
| `hdcommunity_admin_comment_review_batch` | POST /agent/admin/comment/review/batch | `ids`(必) `action`(必) `remark` |
| `hdcommunity_admin_comment_online` | POST /agent/admin/comment/online | `id`(必) `online`(必) |
| `hdcommunity_admin_stats` | GET /agent/admin/stats | 无 |

#### 2.3.3 数据展示面（2 个，公开只读）

| 工具名 | 后端接口 | inputSchema |
|---|---|---|
| `hdcommunity_show_blog_list` | GET /agent/show/blog/list | `page_no` `page_size` `key_word` |
| `hdcommunity_show_blog_detail` | GET /agent/show/blog/detail | `ref`(必) |

### 2.4 工具返回契约（通用）

```json
{ "ok": true, "data": { ... } }
或
{ "ok": false, "error": { "code": "AUTH_FAILED", "message": "..." } }
```

- 成功：`ok=true` + `data`（后端 `ApiResponse.data`）。
- 失败：`ok=false` + `error`（后端 `code/message` 映射，见 §2.7）。

### 2.5 后端调用层（`http-client.mjs`）

```js
// 用户面：逐请求注入 AK/SK
callBlog(method, path, {query, body})   → BACKEND_BASE + headers(X-HW-AK/X-HW-SK/...)
// 公开只读：无鉴权
callShow(method, path, {query, body})   → BACKEND_BASE
// 管理面：Bearer（显式 token 或会话缓存）
callAdmin(sessionId, method, path, {query, body, token}) → BACKEND_BASE + Authorization: Bearer
// 管理面登录/注销：真实接口 /manage/auth/login|logout
loginAdmin(username, password) / logoutAdmin(sessionId, token)
```

- 单一后端 base（§1.6），用户面与管理面同 base、不同路径前缀。
- 统一捕获 HTTP 状态与 `ApiResponse.code`，转 §2.4 返回结构。

### 2.6 管理面 token 会话管理（解决评审 P0-3）

**设计：MCP 进程内按 `sessionId` 缓存 + 允许显式传入覆盖。**

```js
// src/session.mjs
const store = new Map();          // sessionId -> { token, username, role, savedAt }
setSessionToken(sessionId, {token, username, role})
getSessionToken(sessionId) / clearSessionToken(sessionId)
```

规则：
1. `admin_login` → 后端返回 `{token, user}` → 写入 `store[sessionId]`，同时把 token 返回给 Agent。
2. 其余管理面工具：`token` 参数缺失 → 用 `store[sessionId]`；显式传入 → 覆盖。
3. **会话隔离**：`sessionId` 由协议层提供（stdio 固定 `stdin`，remote 每连接一个）。
4. **过期处理**：后端 401 → 返回 `{ok:false, error:{code:'UNAUTHORIZED'}}` + 文案「登录已过期，请重新调用 hdcommunity_admin_login」。
5. `admin_logout` → 调后端 + `clearSessionToken(sessionId)`。

### 2.7 错误处理与映射（解决评审 P1-7）

| 后端 (HTTP / ApiResponse.code) | MCP tool error.code | 文案 |
|---|---|---|
| 401 / 10001 | `UNAUTHORIZED` | 登录已过期 / AK/SK 无效 |
| 403 / 10002·10003 | `FORBIDDEN` | 无权限（管理面白名单未命中） |
| 400 / 20000 | `PARAM_ERROR` | 参数错误 |
| 404 / 10004 | `NOT_FOUND` | 资源不存在 |
| 429 / 30001 | `RATE_LIMITED` | 请求过于频繁 |
| 5xx / 90000 | `UPSTREAM_ERROR` | 后端异常 |
| 用户面缺 AK/SK | `AUTH_MISSING` | 未配置 AK/SK |
| 用户面 IAM 认证失败 | `AUTH_FAILED` | AK/SK 无效或已过期 |

- MCP 层约束：`isError:true` 仅用于「参数缺失/未知工具」协议错误；业务错误走 `{ok:false}`。
- 后端新增错误码（用户面 Agent 入口，照 `hdopenservice`）：`AUTH_AK_MISSING`(400)、`AUTH_SK_MISSING`(400)、`AUTH_FAILED`(401)、`DOMAIN_NOT_WHITELISTED`(403)。
- 后端已有 `ErrorCode` 新增（合并版）：`BLOG_STATE_INVALID`、`ACTION_INVALID`。

### 2.8 限流与幂等（解决评审 P2-11）

- 后端网关级：所有 `/agent/*` 走 `RateLimitUtil`（已有），用户面按 `domainId`、管理面按 `adminId` 维度限流。
- 写操作幂等：`blog_create` 后端按 `domainId + sha256(title) + 时间窗(如 30s)` 幂等键，防 Agent 重复提交。
- MCP 层不做限流（后端为准）。

### 2.9 数据展示面鉴权（解决评审 P2-12）

- 公开只读，**无需登录**。防刷由后端 `/agent/show/*` 的 IP 维度限流保障。
- 「轻量 API Key」暂不启用，留作后续增强。

---

## 3. Skill 设计

### 3.1 SKILL.md 结构与目录规范（照抄 devkit）

```markdown
---
name: hd-blog-author
description: 'Use when a developer wants to write/publish a blog ... Triggers: 写博客, 发博客 ... NOT for: reviewing blogs (use hd-blog-operator).'
version: 1
---

# <标题>
**STOP - Do not answer from general knowledge.** Follow the procedure below.
## Overview
## Workflow（步骤，引用 MCP 工具名）
## References（可选 references/*.md）
```

目录：`skills/hd-<用途>/SKILL.md`（+ 可选 `references/`、`scripts/`）。

### 3.2 skill 清单（已实现）

| skill | 用途 | 主要工具 |
|---|---|---|
| `hd-blog-author` | 开发者「写→发→查审核→看数据」 | `blog_create`、`blog_mine`、`blog_detail`、`user_stat`、`file_upload` |
| `hd-blog-operator` | 运营「待审清理 / 巡检」 | `admin_login`、`admin_blog_page`、`admin_blog_review(_batch)`、`admin_stats` |
| `hd-blog-promote` | 博客 → 各平台推广文案 | `show_blog_list`、`show_blog_detail` |
| `hd-experience` | 体验案例上报（直调体验官） | 无 MCP 工具（脚本直调，见 §3.4） |

### 3.3 skill 定义要点

- **hd-blog-author**：引导补全 title/content/封面（`file_upload` 得 URL）→ `blog_create` → 提示"进入待审核" → `blog_mine`/`blog_detail` 查状态。
- **hd-blog-operator**：`admin_login` → `admin_blog_page(status=1)` 取待审 → 逐条/批量 `admin_blog_review` → `admin_stats` 汇报；强调"审核是写操作，需用户确认"。
- **hd-blog-promote**：`show_blog_list`/`show_blog_detail` 取内容 → 生成适配各平台文案（纯生成，不发布）。

### 3.4 体验官 skill 的「打包过程」落地（解决评审 P1-10）

**澄清**：不做后台数据采集器。「打包使用过程」= **由 Agent 在对话中把刚完成的操作总结为体验案例**，skill 提供模板 + 直调体验官接口的脚本。

```
skills/hd-experience/
├─ SKILL.md
└─ scripts/report.mjs        # 参照 submit.mjs：带 X-HW-AK/X-HW-SK 直调体验官接口
```

`report.mjs` 契约：`node report.mjs --title ... --description ... --steps-json '<json>' [--dry-run] [--endpoint <url>]`；认证读 vault；`HDOFFICER_ENDPOINT` 未配置时 `--dry-run` 打印 payload。**后端零存储**。

### 3.5 skill 检索/加载

照抄 devkit：`hdcommunity_find_skill` + `hdcommunity_retrieve_skill`（M0 可后补）。

---

## 4. 后端 hdblogservice（**后续迭代，本次不实现**）

> 用户面与管理面**已合并为单一 Spring Boot 服务**：端口 8080，context-path `/api/v1/blogservice`；用户面在 `/blog|comment|draft|user|file/**`，管理面在 `/manage/**`；同进程复用 Service。
> 本节原 5.x（管理面）内容已并入。

### 4.1 认证

**用户面（AK/SK）**：**直接 copy `hdopenservice` 的 3 个类**到 `hdblogservice`（**不加 Maven 模块**）：

| 类 | 职责 |
|---|---|
| `AgentAuthFilter` | `OncePerRequestFilter`，拦 `/agent/**`；校验 `X-HW-AK`(必)/`X-HW-SK`(必)/`X-HW-Security-Token`(可选)/`X-HW-PROJECT-ID`；失败 400/401 |
| `AgentAuthService` | `HwSigner` 签名 → `GET /v3/auth/domains` → `domains[0].id/name` = domainId/domainName |
| `HwSigner` | SDK-HMAC-SHA256 签名（支持 securityToken） |
| `AgentPrincipal` | record `{domainId, domainName, projectId, region}`，写入 request attribute |
| `AgentAuthConfig` | `@Configuration` + `FilterRegistrationBean`（copy 方式，不用自动装配） |

接入：copy 进 `common/agent/` 包；`WebConfig` 注册 filter 到 `/agent/*`。配置项：`IAM_DOMAINS_ENDPOINT`（默认 `https://iam.myhuaweicloud.com`）、`AGENT_AUTH_ENABLED`。

**管理面（内部登录，沿用，不引入 AK/SK）**：复用现有 `AuthController(/manage/auth/login)`、`TokenService`（Redis，TTL 120min）、`AuthInterceptor`、`AdminContext`。新增 `AgentAdminInterceptor`（或扩展现有拦截器）拦 `/agent/admin/**`，Bearer → `AdminContext`。废弃默认明文口令 `admin/123456`（仅本地联调开关保留）。**待确认**：内部登录是否纳入统一 SSO/更严密码策略。

### 4.2 用户面身份模型与迁移（解决 P0-4）

**决策**：用户面 Agent 身份主键 = `hcloud_domain_id`（账号级，一人=一账号）。

```sql
ALTER TABLE hd_blog_user
  ADD COLUMN hcloud_domain_id   VARCHAR(64) NULL COMMENT '华为云账号ID',
  ADD COLUMN hcloud_domain_name VARCHAR(255) NULL COMMENT '账号名';
CREATE UNIQUE INDEX uk_blog_user_domain ON hd_blog_user(hcloud_domain_id);
```

流程：`Agent: AK/SK → AgentAuthFilter → domainId → BlogUserService.getOrCreateByDomain(domainId, domainName) → UserContext.set(user.getId())`。

- `BlogUserService` 新增 `getOrCreateByDomain`：按 `hcloud_domain_id` 查/建；建时 `uid = "hw-" + domainId`（与 Web 端 `u-*` 区分）。
- `UserContext`（ThreadLocal<Long>）不变；`UserContextInterceptor` 保留（Web 端 `X-User-Uid` 不受影响），对 `/agent/**` 跳过。
- **存量**：Web 端 `u-100x` 保留不动；Agent 用户按 domain 新建档。可选一次性映射脚本。
- **待业务确认**：Web 端 devdata `uid` 是 IAM 用户级还是账号级（影响是否合并）。

### 4.3 用户面 Agent 聚合接口契约（解决 P0-1）

**context-path**：`/api/v1/blogservice`，前缀 `/agent/blog/*`。响应统一 `ApiResponse{code,message,data}`。

| # | 方法 路径 | 请求 | 响应 data |
|---|---|---|---|
| 1 | GET `/agent/blog/list` | `page_no` `page_size` `key_word` `type` | `{total,page_no,page_size,list:[{ref,title,intro,cover_url,author_name,author_uid,view_nums,comm_nums,vote_nums,create_time}]}` |
| 2 | GET `/agent/blog/detail` | `ref`(必) `log_view`(默认false) | `{ref,title,content,intro,cover_url,author_uid,author_name,create_time,status,view_nums,comm_nums,vote_nums}` |
| 3 | POST `/agent/blog/save` | `{ref?,title,content,intro?,cover_url?}` | `{ref}`（新建 status=1 待审核） |
| 4 | DELETE `/agent/blog/{ref}` | path `ref` | `null`（仅作者） |
| 5 | GET `/agent/blog/mine` | `status` `page_no` `page_size` | `{total,list:[BlogSummary]}` |
| 6 | GET `/agent/blog/favorites` | `page_no` `page_size` | `{total,list:[BlogSummary]}` |
| 7 | GET `/agent/blog/draft/list` | — | `[{id,title,content,update_time}]` |
| 8 | POST `/agent/blog/draft/save` | `{draft_id?,title?,content}` | `{id}` |
| 9 | DELETE `/agent/blog/draft/{id}` | path | `null` |
| 10 | GET `/agent/blog/comment/list` | `id`(必) `level`(1\|2) `page_no` `page_size` | `{total,list:[{id,blog_ref,content,author_name,author_photo,create_time,status,children?}]}` |
| 11 | POST `/agent/blog/comment/add` | `{blog_ref,content,parent_id?}` | `{id}`（status=1） |
| 12 | POST `/agent/blog/comment/edit` | `{comment_id,content}` | `null` |
| 13 | DELETE `/agent/blog/comment/{comment_id}` | path | `null` |
| 14 | POST `/agent/blog/vote` | `{ref,operation_type}` | `null` |
| 15 | POST `/agent/blog/favorite` | `{ref,operation_type}` | `null` |
| 16 | POST `/agent/blog/follow` | `{author_uid,operation_type}` | `null` |
| 17 | GET `/agent/blog/user/profile` | — | `{uid,mem_alias,mem_name,mem_photo}` |
| 18 | GET `/agent/blog/user/stat` | — | `{blog_count,view_total,vote_total}` |
| 19 | POST `/agent/blog/file/upload` | `{name,content_base64}` | `{url}` |

约定：身份来自 `AgentPrincipal.domainId`（**不接受 body 传 domainId**）；分页参数 `page_no/page_size`；错误码见 §2.7。

### 4.4 管理面 Agent 聚合接口契约

**前缀 `/agent/admin/*`**（同 base `/api/v1/blogservice`）。审查 DTO 与现有 `module/manage` 对齐：review 用 `remark`；online/top 用布尔语义的 0/1。

| # | 方法 路径 | 请求 | 响应 data |
|---|---|---|---|
| 1 | POST `/agent/admin/blog/review` | body `{id, action:'approve'\|'reject', remark?}` | `null`（写 `hd_blog_review_record`） |
| 2 | POST `/agent/admin/blog/review/batch` | body `{ids:[], action, remark?}` | `{affected}`（>1 生成 batch_no） |
| 3 | POST `/agent/admin/blog/online` | body `{id, online:0\|1}` | `null`（仅已通过可上下线） |
| 4 | POST `/agent/admin/blog/top` | body `{id, top:0\|1}` | `null`（仅已通过且已上线可置顶） |
| 5 | GET `/agent/admin/blog/page` | `page_no page_size status online keyword` | `{total,page_no,page_size,list:[BlogVO]}` |
| 6 | POST `/agent/admin/comment/review` | body `{id, action, remark?}` | `null` |
| 7 | POST `/agent/admin/comment/review/batch` | body `{ids, action, remark?}` | `{affected}` |
| 8 | POST `/agent/admin/comment/online` | body `{id, online}` | `null` |
| 9 | GET `/agent/admin/comment/page` | `page_no page_size status online keyword` | `{total,list:[CommentVO]}` |
| 10 | GET `/agent/admin/stats` | — | `{blog:{pending,approved,rejected,online,top}, comment:{...}}` |
| 11 | GET `/agent/admin/blog/{id}/records` | `page_no page_size` | `{total,list:[ReviewRecord]}` |
| 12 | POST `/agent/admin/login` | body `{username,password}` | `{token, user:{id,username,nick_name,role}}` |
| 13 | POST `/agent/admin/logout` | header Bearer | `null` |

> 直接复用现有 `module/manage` 的 Service（`BlogService`/`BlogManageController` 逻辑、审计记录）。
> **注**：登录亦可直接用现有真实路径 `/manage/auth/login`（toolkit 默认即此），`/agent/admin/login` 为可选聚合别名。

### 4.5 管理面权限：预制表 + 角色清单 + 白名单粒度（解决 P1-6）

```sql
CREATE TABLE hd_community_operator (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_username VARCHAR(64) NOT NULL,       -- 关联 hd_blog_admin_user.username
  role VARCHAR(32) NOT NULL,
  status TINYINT DEFAULT 1,
  create_time DATETIME, update_time DATETIME,
  UNIQUE KEY uk_username (admin_username)
);
CREATE TABLE hd_community_role_tool (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(32) NOT NULL,
  tool_name VARCHAR(64) NOT NULL,            -- MCP 工具名（见 §2.3.2）
  allow TINYINT DEFAULT 1,
  UNIQUE KEY uk_role_tool (role, tool_name)
);
```

**白名单粒度**：`tool_name` = MCP 工具名（`hdcommunity_admin_*`）；校验在 `/agent/admin/*` 入口。

**默认角色清单（占位，业务可调）**：

| 角色码 | 名称 | 允许工具 |
|---|---|---|
| `super_admin` | 超级管理员 | 全部 `admin_*` |
| `blog_reviewer` | 博客审核员 | `admin_blog_page/review/review_batch/online/top/records/stats` |
| `comment_reviewer` | 评论审核员 | `admin_comment_page/review/review_batch/online/stats` |
| `readonly_ops` | 只读运营 | `admin_blog_page/admin_comment_page/admin_stats` |

- 维护入口：本期 DBA/脚本；未命中 operator → 拒绝全部 `admin_*`（`FORBIDDEN`）。

### 4.6 审核状态归一化（解决 P1-8）

| 实体 | 库内字段 | 对外/MCP | 映射 |
|---|---|---|---|
| 博客 | `status` 0草稿/1待审/2通过/3驳回；`online` 0/1；`is_top` 0/1 | 直接透出 | — |
| 评论 | `state` 2审/4通过/6驳回 | `status` 1待审/2通过/3驳回 | 2→1,4→2,6→3 |

### 4.7 成长积分触发（解决 P1-9）⏸ 本迭代不实现

> **本迭代不实现，顺延后续迭代。**

- 触发点：`blog_create`（新建）落库成功且进入待审核后。
- 方式：**异步 + 重试**（`hd_points_retry` + `PointsRetryJob`），幂等键 `blog_id`。
- `receive-reward` body：`{domain_id, account_name, type:1, source_ecology_type:10, mission_info:[{id, commit_time, source}]}`。
- 认证镜像 `GrowthServiceClient`。**待确认**：`mission_info.id`（发博客任务码）。

### 4.8 数据模型变更（hdblogservice，单服务）

```sql
-- V4__agent_identity.sql
ALTER TABLE hd_blog_user
  ADD COLUMN hcloud_domain_id VARCHAR(64) NULL,
  ADD COLUMN hcloud_domain_name VARCHAR(255) NULL;
CREATE UNIQUE INDEX uk_blog_user_domain ON hd_blog_user(hcloud_domain_id);

-- V5__manage_permission.sql
CREATE TABLE hd_community_operator (...) ;
CREATE TABLE hd_community_role_tool (...) ;

-- V6__points_retry.sql（后续迭代）
CREATE TABLE hd_points_retry (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  domain_id VARCHAR(64) NOT NULL, account_name VARCHAR(255),
  biz_type VARCHAR(32) NOT NULL, biz_id VARCHAR(64) NOT NULL,
  status TINYINT DEFAULT 0, retry_count INT DEFAULT 0, last_error VARCHAR(512),
  create_time DATETIME, update_time DATETIME,
  UNIQUE KEY uk_biz (biz_type, biz_id)
);
```

> 现有迁移：`V1__ddl_init_schema`（内容表）、`V2__ddl_manage_tables`（管理表）、`V3__dml_seed_reference_data`（种子）。新迁移从 `V4` 起。

### 4.9 改造清单（hdblogservice）

1. copy `hdopenservice` 的 3 个类 + `AgentAuthConfig` 到 `common/agent/`（不加模块）。
2. `WebConfig` 注册 `AgentAuthFilter` → `/agent/*`；`UserContextInterceptor` 对 `/agent/**` 跳过；管理面 `/agent/admin/**` 走 `AgentAdminInterceptor`。
3. `BlogUserService` 加 `getOrCreateByDomain`。
4. 新增 `module/agent/controller`：`BlogAgentController`、`CommentAgentController`、`DraftAgentController`、`UserAgentController`、`FileAgentController`、`ShowAgentController`、`BlogAdminAgentController`、`CommentAdminAgentController`、`StatsAgentController`。
5. `RolePermissionService`：读权限表按工具名判定。
6. Flyway `V4/V5`（+后续 V6）。
7. `RateLimitUtil` 接入 `/agent/*`；`blog_create` 幂等。

---

## 5. 附录

### 5.1 错误码总表（新增）

| code | HTTP | 场景 |
|---|---|---|
| `AUTH_AK_MISSING` | 400 | 用户面缺 X-HW-AK |
| `AUTH_SK_MISSING` | 400 | 用户面缺 X-HW-SK |
| `AUTH_FAILED` | 401 | AK/SK 无效或 IAM 认证失败 |
| `DOMAIN_NOT_WHITELISTED` | 403 | 账号不在白名单（预留） |
| `ADMIN_ROLE_DENIED` | 403 | 管理面角色无工具权限 |
| `RATE_LIMITED` | 429 | 请求过于频繁（复用 30001） |
| `BLOG_STATE_INVALID` / `ACTION_INVALID` | 400 | 状态非法 / 动作非法（合并版已有） |

### 5.2 数据模型变更总表（均在 hdblogservice 单服务）

| 表/变更 | 说明 |
|---|---|
| `hd_blog_user` +2 字段 +1 唯一索引 | `hcloud_domain_id/name` |
| `hd_community_operator` 新增 | 内部账号 → 角色 |
| `hd_community_role_tool` 新增 | 角色 → 工具白名单 |
| `hd_points_retry` 新增（后续） | 发积分失败重试 |

> 注意：原 `hd_blog_admin_user`（管理员）与 `hd_blog_review_record`/`hd_blog_comment_review_record` 已随合并版在 `V2__ddl_manage_tables` 中建立。

### 5.3 待确认项（本迭代仅第 5 项影响 toolkit，其余为后续后端）

| # | 待确认 | 影响 |
|---|---|---|
| 1 | Web 端 devdata `uid` 是 IAM 用户级还是账号级 | §4.2 身份合并策略 |
| 2 | 发博客积分的 `mission_info.id`（任务码） | §4.7 |
| 3 | 体验官上报接口地址/契约（对方未提供） | §3.4 |
| 4 | 管理面默认角色清单是否采纳 §4.5 占位 | §4.5 |
| 5 | 生产后端地址/环境（`HDCOMMUNITY_BASE`） | §1.6 |
| 6 | 内部登录是否纳入统一 SSO/密码策略 | §4.1 |

### 5.4 里程碑映射

| 里程碑 | 交付 | 范围 |
|---|---|---|
| **M0（本次迭代）** | **端侧 toolkit 包**：MCP 框架 + 安装器 + 凭证读取 + 三组工具定义 + 4 个 skill | §1/§2/§3（后端按契约对接，联调待后端就绪） |
| M1（后续） | 后端用户面 `/agent/blog/*` 19 接口 + copy 认证三件套 + 身份字段 | §4.1/4.2/4.3 |
| M2（后续） | 后端管理面 `/agent/admin/*` 13 接口 + 权限表 | §4.4/4.5 |
| M3（后续） | 成长积分（§4.7）+ 体验官上报接口（§3.4）+ 后端联调 | §3.4/§4.7 |

---

**本次迭代评审重点（仅端侧）：** §1 Toolkit 框架、§2 MCP 工具定义与 inputSchema、§3 Skill 内容、§1.6 生产地址。
后端契约（§4）本迭代不实现，作为后续迭代依据先评审通过即可。