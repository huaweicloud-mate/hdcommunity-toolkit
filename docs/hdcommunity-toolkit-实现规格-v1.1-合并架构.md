# HDCommunityToolkit 实现规格 / 接口契约（评审稿 v1.1 · 合并架构）

> 日期：2026-10-20 ｜ v1.1 变更：按「用户面 + 管理台已合并为单一服务 `hdblogservice`」重写后端章节；前端 Toolkit 章节按已落地仓 `huaweicloud-mate/hdcommunity-toolkit@0.1.0` 校准。
> 参考：
> - Toolkit 仓（端侧，已实现）：`github.com/huaweicloud-mate/hdcommunity-toolkit`（私有）
> - 后端仓（合并后单一服务）：`gitcode.com/OPCTeam/HDBlogService` → 目录 `hdblogservice/`
> - 骨架参考：`huaweicloud-devkit`

---

## v1.1 变更摘要（相对 v1.0）

| # | v1.0 原方案 | v1.1 合并架构 |
|---|---|---|
| 1 | 两个后端：`hdblogservice`(8080) + `hdblogmngservice`(8081) | **单一后端** `hdblogservice`（context-path `/api/v1/blogservice`；本地 8080，部署 8081） |
| 2 | 管理面 `/agent/admin/*` 落在独立服务 | 管理面 `/agent/admin/*` 与用户面 `/agent/blog/*` **同进程**；现有管理台 UI 走 `/manage/**` 不变 |
| 3 | 认证独立 Maven 模块 `blog-agent-auth` | 内嵌到 `hdblogservice/common/security`（单 module 工程，不新建聚合模块） |
| 4 | Flyway `V3/V4` | 现有已占 `V1/V2/V3` → 新迁移从 **`V4`** 起 |
| 5 | 管理面登录新接口 `POST /agent/admin/login` | 复用现有 `TokenService`，新增 `/agent/admin/login`；**现有 `/manage/auth/login` 保留**（前端用） |
| 6 | Toolkit 默认 `blogmng = :8081/api/v1/blogmngservice` | Toolkit 改为**单一 `BACKEND_BASE`**（env `HDCOMMUNITY_BASE`）指向合并服务 `/api/v1/blogservice` |
| 7 | Toolkit 登录路径 `/admin/auth/login` | 改为 `/manage/auth/login`（env `HDCOMMUNITY_ADMIN_LOGIN_PATH`）；注销 `/manage/auth/logout` |
| 8 | 错误码 `ADMIN_ROLE_DENIED=10003` | 与现有 `AUTH_FAILED(10003)` **冲突** → 重编号（见 §6.1） |
| 9 | Toolkit 待实现 | 已落地 **35 个 MCP 工具**（用户面 20 / 管理面 13 / 展示面 2）+ 4 Skill；`remote` 传输 / `find_skill` / `search_docs` **仍未实现** |

---

## 0. 总述（总体实现方案）

### 0.1 目标与范围

一个独立发布的 Agent 工具包 `hdcommunity-toolkit`（Node.js），向 opencode/codex/码道等 Agent 提供**华为云社区业务**的 MCP 工具 + Skill。首批接入博客（用户面 + 管理面 + 对外只读），后续成长体系/大赛/活动按同一框架接入。

本期交付范围（对应设计 §11 P0–P3）：
- 工具包壳（MCP server + Skill + 安装器）——**已落地**
- 博客用户面 Agent 能力（看/写/发/评/赞/藏/关注/草稿/图片）
- 博客管理面 Agent 能力（登录/审核/上下线/置顶/统计）
- 博客对外只读能力
- 成长积分对接（发博客得积分）
- 体验官上报（skill 直调）

### 0.2 系统全景（合并后）

```
┌─ Agent (opencode / codex / 码道) ──────────────────────────┐
│   本地进程 hdcommunity-toolkit-mcp（Node ESM）              │
│   ├─ 会话态：管理面 token 缓存（sessionId → token）          │
│   ├─ 凭证源：~/.config/huaweicloud/credentials.json (AK/SK) │
│   └─ 工具层：undici HTTP                                    │
│        ├─ 用户面 → X-HW-AK/SK(+Security-Token) → /agent/blog/*  │
│        ├─ 管理面 → Authorization: Bearer <token> → /agent/admin/*│
│        └─ 展示面 → 无鉴权 → /agent/show/*                   │
└────────────────────────────────────────────────────────────┘
      │  三条链路全部打到同一后端
      ▼
┌────────────────────────────────────────────────────────────┐
│ hdblogservice（唯一后端，context-path /api/v1/blogservice）  │
│  server.port=${PORT:8080}（部署容器 8081）                   │
│  ├─ 现有用户面：/blog /comment /draft /user /file /health    │
│  ├─ 现有管理台：/manage/**（Bearer，AuthInterceptor）        │
│  ├─ 新增用户面：/agent/blog/*  ← AgentAuthFilter(AK/SK)      │
│  ├─ 新增管理面：/agent/admin/* ← AgentAdminInterceptor(Bearer)│
│  └─ 新增展示面：/agent/show/*  公开只读                      │
│  聚合接口 → 复用现有 Service（同进程直调）                    │
└────────────────────────────────────────────────────────────┘
      │
      ▼
  MySQL huaweicloud_blog（Flyway history: flyway_schema_history_blog）
  Redis（管理台 token / 限流）
```

### 0.3 技术栈定稿

| 组件 | 技术栈 | 依据 |
|---|---|---|
| Toolkit（MCP server + 安装器） | **Node.js ≥ 22，ESM（`.mjs`）** | 与 devkit 一致；已落地 |
| Toolkit HTTP 客户端 | `undici`（唯一运行时依赖 `^8.11.2`） | 已落地 |
| 后端（用户面 + 管理面，单一服务） | Spring Boot 3.3.5 / **Java 17** / MyBatis-Plus 3.5.9 / Redis / Flyway | `hdblogservice/pom.xml` |
| Agent 认证 | **内嵌类**（`common/security`），非独立模块 | 单 module 工程 |

### 0.4 命名约定（定稿）

| 维度 | 规范 | 示例 |
|---|---|---|
| npm 包名 | `hdcommunity-toolkit` | — |
| CLI bin | `hdcommunity-toolkit` | `npx hdcommunity-toolkit install` |
| MCP bin | `hdcommunity-toolkit-mcp` | — |
| MCP 工具名 | `hdcommunity_<面>_<动作>` | `hdcommunity_blog_create` |
| Skill 目录 | `skills/hd-<用途>/SKILL.md` | `skills/hd-blog-author/` |
| 后端 context-path | `/api/v1/blogservice` | 用户面 + 管理台 + Agent 同一前缀 |
| 后端 Agent 接口 | `/agent/blog/*`、`/agent/admin/*`、`/agent/show/*` | `/api/v1/blogservice/agent/blog/list` |
| 后端管理台接口（现有） | `/manage/**` | `/api/v1/blogservice/manage/blog/page` |
| 数据表 | 新表前缀 `hd_community_*`；现有表沿用 `hd_blog_*` | `hd_community_operator` |

> MCP 工具名前缀保持 `hdcommunity_`（已定，代码已实现）。

### 0.5 模块分层与交付物

| 层 | 交付物 | 位置 |
|---|---|---|
| Toolkit 主体 | 35 MCP 工具 + 4 Skill + 安装器 | `huaweicloud-mate/hdcommunity-toolkit`（独立 Node 包，**已实现**） |
| 认证 | `AgentAuthFilter/AgentAuthService/HwSigner/AgentPrincipal` | `hdblogservice/src/main/java/com/huaweicloud/blog/common/security/`（内嵌） |
| 用户面后端改造 | `/agent/blog/*` 聚合接口 + 身份字段 | `hdblogservice/.../module/agent/` |
| 管理面后端改造 | `/agent/admin/*` + 权限表 | `hdblogservice/.../module/agent/` + `module/manage/` |

### 0.6 与 `huaweicloud-devkit` 的关系（复用边界）

**照搬（结构/代码模式）**：MCP server / dispatch / TOOL_DEFINITIONS / 安装器 / 多 agent manifest 机制。**已落地**。

**复用（仅数据格式）**：读取 `~/.config/huaweicloud/credentials.json`（`{ak, sk, securityToken, region}`）作为 AK/SK 来源——**只复用文件格式，不 `import` devkit 内部模块**。

**不依赖**：Toolkit 自带精简凭证读取（`src/credentials.mjs`，~72 行）。

---

## 1. Toolkit 主体框架（按实际仓校准）

### 1.1 目录结构（实际）

```
hdcommunity-toolkit/
├─ package.json                     # v0.1.0, type=module
├─ plugin.json                      # agent-plugins.org schema
├─ mcp.json                         # 通用 MCP 注册（npx 启动）
├─ .mcp.json                        # 本地开发注册（node ./src/mcp-server.mjs）
├─ .claude-plugin/plugin.json
├─ .codex-plugin/plugin.json
├─ bin/setup.cjs                    # CJS 薄包装 → src/setup-cli.mjs
├─ src/
│  ├─ mcp-server.mjs                # MCP 进程入口（stdio）
│  ├─ mcp-protocol.mjs              # dispatch
│  ├─ tools/
│  │  ├─ index.mjs                  # 工具汇总 + callTool 路由
│  │  ├─ blog-tools.mjs             # 用户面 20 个
│  │  ├─ admin-tools.mjs            # 管理面 13 个
│  │  ├─ show-tools.mjs             # 展示面 2 个
│  │  └─ http-client.mjs            # callBlog/callShow/callAdmin
│  ├─ session.mjs                   # 管理面 token 会话缓存
│  ├─ config.mjs                    # 后端地址/区域/超时
│  ├─ credentials.mjs               # 读 AK/SK
│  ├─ errors.mjs                    # 返回结构 + 错误映射
│  └─ version.mjs
├─ skills/
│  ├─ hd-blog-author/SKILL.md
│  ├─ hd-blog-operator/SKILL.md
│  ├─ hd-blog-promote/SKILL.md
│  └─ hd-experience/{SKILL.md, scripts/report.mjs}
├─ scripts/smoke.mjs
├─ docs/                            # 设计 / 实现规格 / 迭代计划
└─ .github/workflows/               # npm 发布 CI
```

### 1.2 package.json 契约（实际）

```json
{
  "name": "hdcommunity-toolkit",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "hdcommunity-toolkit": "./bin/setup.cjs",
    "hdcommunity-toolkit-mcp": "./src/mcp-server.mjs"
  },
  "scripts": { "start": "node ./src/mcp-server.mjs", "smoke": "node ./scripts/smoke.mjs" },
  "dependencies": { "undici": "^8.11.2" },
  "engines": { "node": ">=22" },
  "license": "Apache-2.0"
}
```

### 1.3 进程入口

- **stdio（默认，已实现）**：JSON-RPC over stdio，支持 `Content-Length` 分帧与 `\n` 分帧；解析失败 `-32700`。
- **remote（`--transport remote --port 9528`）：未实现**，当前仅打印告警后回落 stdio。
- `initialize` → `tools/list` → `tools/call`；`sessionId`：stdio 固定 `'stdin'`。

### 1.4 凭证来源（`src/credentials.mjs`，实际）

按优先级读取 AK/SK：
1. 环境变量 `HW_ACCESS_KEY`/`HW_SECRET_KEY`/`HW_SECURITY_TOKEN`（+ `HUAWEICLOUD_SDK_*` 别名）
2. `~/.config/huaweicloud/credentials.json`（devkit S1 vault）
3. `~/.hcloud/config.json`（KooCLI profile）

导出 `loadCredentials()` → `{ ak, sk, securityToken, region, projectId }`、`hasCredentials()`、`maskAk()`。用户面工具逐次注入 `X-HW-AK/X-HW-SK/X-HW-Security-Token`。

### 1.5 安装器（`src/setup-cli.mjs`，实际）

命令：`install / uninstall / status / help`。
目标：`opencode, codex, codearts, codearts-work, workbuddy, dsh, hermes, openclaw, atomcode, all`。
动作：`copyDir(skills)` 到各 agent 的 skills 目录；opencode 额外合并 `~/.config/opencode/opencode.json` 的 `mcp` 段（其余 agent 打印手工 MCP 片段）。

### 1.6 配置（`src/config.mjs`，实际）

```js
export const BACKEND_BASE = process.env.HDCOMMUNITY_BASE || 'http://127.0.0.1:8080/api/v1/blogservice';

// 管理面真实登录接口（直接对接现有后端 /manage/auth/*）
export const ADMIN_LOGIN_PATH  = process.env.HDCOMMUNITY_ADMIN_LOGIN_PATH  || '/manage/auth/login';
export const ADMIN_LOGOUT_PATH = process.env.HDCOMMUNITY_ADMIN_LOGOUT_PATH || '/manage/auth/logout';

export const REGION = process.env.HW_REGION || 'cn-north-4';
export const DEFAULT_TIMEOUT_MS = Number(process.env.HDCOMMUNITY_TIMEOUT_MS || 30000);
```

> Toolkit 已按合并架构收敛为**单一 base**（`HDCOMMUNITY_BASE`）；用户面/管理面/展示面三条 Agent 链路同址，管理面登录走现有 `/manage/auth/login`。

---

## 2. MCP 设计

### 2.1 协议层（`src/mcp-protocol.mjs`）

```
dispatch('initialize')      → { protocolVersion, capabilities:{tools:{}}, serverInfo:{name,version} }
dispatch('tools/list')      → { tools: TOOL_DEFINITIONS }
dispatch('tools/call',{name,arguments},{sessionId})
   ├─ 校验 inputSchema.required（缺 → -32602）
   ├─ callTool(name, args, {sessionId})
   └─ 返回 {content:[{type:'text', text: JSON.stringify(result,null,2)}], isError:false}
dispatch('resources/list')  → { resources: [] }
dispatch(unknown)           → -32601（未知方法）/ -32602（未知工具）
```

### 2.2 工具命名与分组

| 组 | 前缀 | 认证 | 后端（合并后同服） |
|---|---|---|---|
| 用户面 | `hdcommunity_blog_*` / `draft_*` / `comment_*` / `user_*` / `file_*` | 每请求带 AK/SK | `/agent/blog/*` |
| 管理面 | `hdcommunity_admin_*` | Bearer token（含独立登录工具） | `/agent/admin/*` |
| 数据展示面 | `hdcommunity_show_*` | 无（公开只读） | `/agent/show/*` |

### 2.3 完整工具清单（实际共 35 个）

参数命名统一 `snake_case`。**下列为 Toolkit 已实现的调用路径**，后端据此实现。

#### 2.3.1 用户面（20 个）

| 工具名 | 后端接口 | 关键参数 |
|---|---|---|
| `hdcommunity_blog_list` | GET `/agent/blog/list` | `page_no, page_size, key_word, type` |
| `hdcommunity_blog_detail` | GET `/agent/blog/detail` | `ref`(必), `log_view` |
| `hdcommunity_blog_create` | POST `/agent/blog/save` | `title`(必), `content`(必), `intro`, `cover_url` |
| `hdcommunity_blog_update` | POST `/agent/blog/save` | `ref`(必), `title, content, intro, cover_url` |
| `hdcommunity_blog_delete` | DELETE `/agent/blog/{ref}` | `ref`(必) |
| `hdcommunity_blog_mine` | GET `/agent/blog/mine` | `status, page_no, page_size` |
| `hdcommunity_blog_favorites` | GET `/agent/blog/favorites` | `page_no, page_size` |
| `hdcommunity_draft_list` | GET `/agent/blog/draft/list` | — |
| `hdcommunity_draft_save` | POST `/agent/blog/draft/save` | `content`(必), `title, draft_id` |
| `hdcommunity_draft_delete` | DELETE `/agent/blog/draft/{id}` | `draft_id`(必) |
| `hdcommunity_comment_list` | GET `/agent/blog/comment/list` | `id`(必), `level, page_no, page_size` |
| `hdcommunity_comment_add` | POST `/agent/blog/comment/add` | `blog_ref`(必), `content`(必), `parent_id` |
| `hdcommunity_comment_edit` | POST `/agent/blog/comment/edit` | `comment_id`(必), `content`(必) |
| `hdcommunity_comment_delete` | DELETE `/agent/blog/comment/{comment_id}` | `comment_id`(必) |
| `hdcommunity_blog_vote` | POST `/agent/blog/vote` | `ref`(必), `operation_type`(必) |
| `hdcommunity_blog_favorite` | POST `/agent/blog/favorite` | `ref`(必), `operation_type`(必) |
| `hdcommunity_blog_follow` | POST `/agent/blog/follow` | `author_uid`(必), `operation_type`(必) |
| `hdcommunity_user_profile` | GET `/agent/blog/user/profile` | — |
| `hdcommunity_user_stat` | GET `/agent/blog/user/stat` | — |
| `hdcommunity_file_upload` | POST `/agent/blog/file/upload` | `name`(必), `content_base64`(必) |

#### 2.3.2 管理面（13 个）

| 工具名 | 后端接口 | 关键参数 |
|---|---|---|
| `hdcommunity_admin_login` | POST `/agent/admin/login` | `username`(必), `password`(必) |
| `hdcommunity_admin_logout` | POST `/agent/admin/logout` | `token`(可选) |
| `hdcommunity_admin_blog_page` | GET `/agent/admin/blog/page` | `page_no, page_size, status, online, keyword, token?` |
| `hdcommunity_admin_blog_review` | POST `/agent/admin/blog/review` | `id`(必), `action`(必), `reason` |
| `hdcommunity_admin_blog_review_batch` | POST `/agent/admin/blog/review/batch` | `ids`(必), `action`(必), `reason` |
| `hdcommunity_admin_blog_online` | POST `/agent/admin/blog/online` | `id`(必), `online`(必) |
| `hdcommunity_admin_blog_top` | POST `/agent/admin/blog/top` | `id`(必), `top`(必) |
| `hdcommunity_admin_blog_records` | GET `/agent/admin/blog/{id}/records` | `id`(必), `page_no, page_size` |
| `hdcommunity_admin_comment_page` | GET `/agent/admin/comment/page` | `page_no, page_size, status, online, keyword` |
| `hdcommunity_admin_comment_review` | POST `/agent/admin/comment/review` | `id`(必), `action`(必), `reason` |
| `hdcommunity_admin_comment_review_batch` | POST `/agent/admin/comment/review/batch` | `ids`(必), `action`(必), `reason` |
| `hdcommunity_admin_comment_online` | POST `/agent/admin/comment/online` | `id`(必), `online`(必) |
| `hdcommunity_admin_stats` | GET `/agent/admin/stats` | `token?` |

#### 2.3.3 数据展示面（2 个，公开只读）

| 工具名 | 后端接口 | 关键参数 |
|---|---|---|
| `hdcommunity_show_blog_list` | GET `/agent/show/blog/list` | `page_no, page_size, key_word` |
| `hdcommunity_show_blog_detail` | GET `/agent/show/blog/detail` | `ref`(必) |

### 2.4 工具返回契约（通用）

```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": { "code": "AUTH_FAILED", "message": "..." } }
```

- 成功：`ok=true` + `data`（后端 `ApiResponse.data`，`code=0`）。
- 失败：`ok=false` + `error`（后端 `code/message` 映射，见 §2.7）。
- `errors.mjs` 的 `CODES`：`AUTH_MISSING / AUTH_FAILED / UNAUTHORIZED / FORBIDDEN / PARAM_ERROR / RATE_LIMITED / NOT_FOUND / UPSTREAM_ERROR`。

### 2.5 后端调用层（`src/tools/http-client.mjs`）

三条通道（均指向同一 `BACKEND_BASE`）：
- `callBlog(method, path, {query, body})`：注入 `X-HW-AK/SK(/Security-Token)/PROJECT-ID/REGION`。
- `callShow(...)`：无鉴权。
- `callAdmin(sessionId, method, path, {query, body, token})`：`token || getSessionToken(sessionId)`，`Authorization: Bearer`。
- `loginAdmin/logoutAdmin`：走 `ADMIN_LOGIN_PATH`/`ADMIN_LOGOUT_PATH`（默认 `/manage/auth/login|logout`）。

统一从 `ApiResponse{code,message,data}` 解包（`code===0` → ok），连接失败 → `UPSTREAM_ERROR`。

### 2.6 管理面 token 会话管理（`src/session.mjs`）

- `setSessionToken(sessionId, {token, username, role})` / `getSessionToken(sessionId)` / `getSession(sessionId)` / `clearSessionToken(sessionId)`。
- `admin_login` → 写缓存 + 返回 token；其余管理面工具 token 参数缺省用缓存、显式传入则覆盖。
- 会话隔离：`sessionId` 由协议层提供（stdio 固定 `stdin`）。
- 401 处理：返回 `UNAUTHORIZED`，提示重新 `hdcommunity_admin_login`。

### 2.7 错误映射（`src/errors.mjs`，需按 §6.1 校准）

| 后端 (HTTP / code) | tool error.code | 文案 |
|---|---|---|
| 401 / 10001 | `UNAUTHORIZED` | 未登录/登录已过期 |
| 403 / 10002 | `FORBIDDEN` | 无权限 |
| 400 / 20000 | `PARAM_ERROR` | 参数错误 |
| 429 / 30001 | `RATE_LIMITED` | 请求过于频繁 |
| 404 / 10004 | `NOT_FOUND` | 资源不存在 |
| 5xx / 90000 | `UPSTREAM_ERROR` | 后端异常 |
| 用户面缺 AK/SK | `AUTH_MISSING` | 未配置 AK/SK |
| 用户面 IAM 认证失败(401) | `AUTH_FAILED` | AK/SK 无效或已过期 |

> ⚠️ 当前 `errors.mjs` 把 `ADMIN_ROLE_DENIED` 硬编码为 `10003`，与后端现有 `AUTH_FAILED(10003,"账号或密码错误")` 冲突，**必须重编号**（见 §6.1）。

### 2.8 限流与幂等

- `/agent/*` 复用现有 `RateLimitUtil`（Redis INCR+TTL）：用户面按 `domainId`、管理面按 `adminId` 维度。
- 写操作幂等：`blog_create` 后端按 `domainId + sha256(title) + 时间窗`，复用现有 `IdempotencyUtil.generateKey(...)`。
- MCP 层不做限流。

### 2.9 数据展示面鉴权

- 公开只读，**无需登录**；防刷由 `/agent/show/*` 的 IP 维度 `RateLimitUtil` 保障。`config.showApiKey` 预留（本期不启用）。

### 2.10 未实现项（Toolkit 侧待办）

- `--transport remote`（Streamable HTTP）未实现（当前仅 stdio）。
- `hdcommunity_find_skill` / `hdcommunity_retrieve_skill` / `hdcommunity_search_docs` **未实现**（规格 §3.5）。
- 体验官上报 endpoint 未提供（`report.mjs` dry-run/local 模式）。
- 配置与工具已对齐合并架构：单一 `BACKEND_BASE`、`/manage/auth/*` 登录、35 个工具（无旧两服务形态残留）。

---

## 3. Skill 设计（已落地 4 个）

### 3.1 SKILL.md 结构

```markdown
---
name: hd-blog-author
description: 'Use when ... Triggers: 写博客, 发博客... NOT for: ...'
version: 1
---
# <标题>
**STOP - Do not answer from general knowledge.** Follow the procedure below.
## Overview / ## Workflow（引用 MCP 工具名）/ ## Rules
```

### 3.2 skill 清单（实际）

| skill | 用途 | 主要工具 |
|---|---|---|
| `hd-blog-author` | 开发者「写→发→查审核→看数据」 | `blog_create/detail/update`、`file_upload`、`user_stat`、`draft_save` |
| `hd-blog-operator` | 运营「待审清理 / 巡检」 | `admin_login`、`admin_blog_page`、`admin_blog_review(_batch)`、`admin_blog_online/top`、`admin_comment_*`、`admin_stats`、`admin_blog_records` |
| `hd-blog-promote` | 博客 → 各平台推广文案 | `show_blog_list`、`show_blog_detail` |
| `hd-experience` | 体验案例上报（脚本直调） | 无 MCP 工具（`scripts/report.mjs`） |

### 3.3 要点

- **hd-blog-author**：补全 title/content/封面（`file_upload` 得 URL）→ `blog_create` → 提示"进入待审核"（status=1）→ `blog_detail` 查状态。
- **hd-blog-operator**：`admin_login` → `admin_blog_page(status=1)` → 逐条/批量 `review` → `admin_stats` 汇报。强调"审核是写操作，需用户确认"。
- **hd-blog-promote**：`show_blog_list/detail` 取内容 → 生成 B站/公众号标题、文案、脚本（纯生成，不发布）。

### 3.4 体验官上报（`skills/hd-experience/scripts/report.mjs`）

- 由 Agent 在对话中把操作总结为体验案例；脚本 `report.mjs` 带 `X-HW-AK/SK` 直调体验官接口；**后端零存储**。
- **体验官接口地址未提供**：当前 `HDOFFICER_ENDPOINT` 未配置或 `--dry-run` 时，脚本以 `local/dry-run` 模式打印结构化 case，不发起上报。

### 3.5 skill 检索/加载——未实现

规格 §3.5 的 `hdcommunity_find_skill` / `hdcommunity_retrieve_skill`（本地遍历 `skills/*/SKILL.md` frontmatter）与可选 `hdcommunity_search_docs` **尚未实现**。

---

## 4. 用户面后端 hdblogservice

### 4.1 认证（内嵌，替代独立 Maven 模块）

在 `hdblogservice` 内新增（`com.huaweicloud.blog.common.security`）：

| 类 | 职责 |
|---|---|
| `AgentAuthFilter` | `OncePerRequestFilter`，拦 `/agent/blog/**`；校验 `X-HW-AK`(必)/`X-HW-SK`(必)/`X-HW-Security-Token`(可选)/`X-HW-PROJECT-ID`；缺 → 400 `AUTH_AK_MISSING`/`AUTH_SK_MISSING` |
| `AgentAuthService` | `HwSigner` 签名 → `GET /v3/auth/domains` → `domains[0].id/name` = domainId/domainName |
| `HwSigner` | SDK-HMAC-SHA256 签名（支持 securityToken） |
| `AgentPrincipal` | record `{ domainId, domainName, projectId, region }`，写入 request attribute |
| 注册 | 在 `WebConfig` 将 `AgentAuthFilter` 注册到 `/agent/blog/**` |

配置项：`IAM_DOMAINS_ENDPOINT`（默认 `https://iam.myhuaweicloud.com`）、`AGENT_AUTH_ENABLED`（默认 true）。

### 4.2 身份模型与迁移

**决策**：用户面 Agent 身份主键 = `hcloud_domain_id`（账号级）。

- 现有：用户面用 `X-User-Uid` 头 → `UserContextInterceptor` → `BlogUserService.getOrCreate(uid,name,photo)`；`UserContext` 为 `ThreadLocal<Long>`（存 `BlogUser.id`）；缺省回落种子用户 1001。
- 变更：新增 `BlogUserService.getOrCreateByDomain(domainId, domainName)`：按 `hcloud_domain_id` 查/建，建档 `uid = "hw-" + domainId`（与 Web 端 `u-*` 区分）。
- `UserContext` 不变；`UserContextInterceptor` 对 `/agent/**` 跳过（避免覆盖 AgentFilter 设置的身份）；`UserContextInterceptor` 在 `WebConfig` 现注册于 `/**`（排除 `/manage/**`,`/health`），需追加排除 `/agent/**`。

身份流转（不改 Web 端）：
```
Agent: AK/SK → AgentAuthFilter → domainId
        → BlogUserService.getOrCreateByDomain(domainId, domainName)
        → UserContext.set(user.getId())
```

存量数据：Web 端 `u-*` 用户保留不动；Agent 用户按 domain 新建档。**待确认**：Web 端 devdata 的 uid 是 IAM 用户级还是账号级。

### 4.3 用户面 Agent 聚合接口契约

**context-path**：`/api/v1/blogservice`，Agent 前缀 `/agent/blog/*`。响应统一 `ApiResponse{code,message,data}`。

| # | 方法 路径 | 请求 | 响应 data |
|---|---|---|---|
| 1 | GET `/agent/blog/list` | `page_no`(默认1) `page_size`(默认20) `key_word` `type` | `{ total, page_no, page_size, list:[{ref,title,intro,cover_url,author_name,author_uid,view_nums,comm_nums,vote_nums,create_time}] }` |
| 2 | GET `/agent/blog/detail` | `ref`(必) `log_view`(默认false) | `{ref,title,content,intro,cover_url,author_uid,author_name,create_time,status,online,is_top,review_remark,view_nums,comm_nums,vote_nums}` |
| 3 | POST `/agent/blog/save` | `{ref?, title, content, intro?, cover_url?}` | `{ ref }`（新建 status=1 待审核） |
| 4 | DELETE `/agent/blog/{ref}` | path `ref` | `null`（仅作者本人） |
| 5 | GET `/agent/blog/draft/list` | — | `[{id,title,content,update_time}]` |
| 6 | POST `/agent/blog/draft/save` | `{draft_id?, title?, content}` | `{id}` |
| 7 | DELETE `/agent/blog/draft/{id}` | path `id` | `null` |
| 8 | GET `/agent/blog/comment/list` | `id`(必) `level`(1\|2) `page_no` `page_size` | `{ total, list:[{id,blog_ref,content,author_name,author_photo,create_time,status,children?}] }` |
| 9 | POST `/agent/blog/comment/add` | `{blog_ref, content, parent_id?}` | `{id}`（status=1 待审） |
| 10 | POST `/agent/blog/comment/edit` | `{comment_id, content}` | `null` |
| 11 | DELETE `/agent/blog/comment/{comment_id}` | path | `null` |
| 12 | POST `/agent/blog/vote` | `{ref, operation_type}` (1/0) | `null` |
| 13 | POST `/agent/blog/favorite` | `{ref, operation_type}` | `null` |
| 14 | POST `/agent/blog/follow` | `{author_uid, operation_type}` | `null` |
| 15 | GET `/agent/blog/user/profile` | — | `{uid,mem_alias,mem_name,mem_photo}` |
| 16 | GET `/agent/blog/user/stat` | — | `{blog_count,view_total,vote_total}` |
| 17 | POST `/agent/blog/file/upload` | `{name, content_base64}` | `{url}` |
| 18 | GET `/agent/blog/mine` | query `status`(可选) `page_no` `page_size` | `{total,page_no,page_size,list:[AgentBlogItem]}` |
| 19 | GET `/agent/blog/favorites` | query `page_no` `page_size` | `{total,page_no,page_size,list:[AgentBlogItem]}` |

**适配要点（现有实现差异）**：
- 现有 `BlogSaveDTO` 用前端字段 `titleData/contentData/introData/litimgUrl` → Agent 接口需另建 DTO 映射为 `title/content/intro/cover_url`。
- 现有 `BlogController` 用 `/blog/detail/{ref}` 路径参数、返回 `Long id`；Agent 接口按上表用 query `ref`、返回 `{ref}`。
- `ref` 规则沿用 `BlogServiceImpl.findByRef()`：去 `blog-` 前缀；Agent 返回 `ref = "blog-"+id`。
- 身份来自 `AgentPrincipal.domainId`（**不接受 body 传 domainId**）；分页参数名 `page_no/page_size`。

### 4.4 审核状态归一化

| 实体 | 库内字段 | 对外/MCP 字段 | 映射 |
|---|---|---|---|
| 博客 | `status` 0草稿/1待审/2通过/3驳回 | `status`(原值) + `online`(0\|1) + `is_top`(0\|1) | 直接透出 |
| 评论 | `state` 2审/4通过/6驳回 | `status` 1待审/2通过/3驳回 | 2→1, 4→2, 6→3 |

- 评论在 Agent 聚合接口做 `state→status` 转换（复用现有服务层的 `stateToStatus`）。
- 博客状态直接透出，语义在 SKILL.md 解释（已实现）。

### 4.5 成长积分触发

- **触发点**：`blog_create`（新建，非编辑）落库成功且进入待审核后。
- **方式**：异步 + 重试，不阻塞返回：`saveBlog(新建) → 写 hd_points_retry(status=0) → 异步调 hdgrowthservice receive-reward → 成功 status=1；失败保留，PointsRetryJob 定时重试`。
- **幂等**：以 `blog_id` 为幂等键。
- `receive-reward` body：`{ domain_id, account_name, type:1, source_ecology_type:10, mission_info:[{id, commit_time, source:1}] }`。
- **待确认**：`mission_info.id`（发博客任务码）由运营提供。

### 4.6 数据模型变更（hdblogservice，Flyway 从 V4 起）

```sql
-- V4__agent_identity.sql
ALTER TABLE hd_blog_user
  ADD COLUMN hcloud_domain_id   VARCHAR(64)  NULL COMMENT '华为云账号ID',
  ADD COLUMN hcloud_domain_name VARCHAR(255) NULL COMMENT '账号名';
CREATE UNIQUE INDEX uk_blog_user_domain ON hd_blog_user(hcloud_domain_id);

-- V6__points_retry.sql（M4 落地，本期未建）
CREATE TABLE hd_points_retry (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  domain_id VARCHAR(64) NOT NULL,
  account_name VARCHAR(255),
  biz_type VARCHAR(32) NOT NULL,     -- 'blog_create'
  biz_id VARCHAR(64) NOT NULL,       -- blog_id
  status TINYINT DEFAULT 0,          -- 0待发/1成功/2失败
  retry_count INT DEFAULT 0,
  last_error VARCHAR(512),
  create_time DATETIME, update_time DATETIME,
  UNIQUE KEY uk_biz (biz_type, biz_id)
);
```

> 现有 Flyway history 表 `flyway_schema_history_blog` 已含 `V1__ddl_init_schema`、`V2__ddl_manage_tables`、`V3__dml_seed_reference_data`；`out-of-order:false`。
> 本期实际编号：**`V4__agent_identity.sql`（身份）、`V5__admin_rbac.sql`（管理面权限）；`V6__points_retry.sql`（积分，M4）**。

### 4.7 改造清单（hdblogservice）

1. `common/security` 新增 `AgentAuthFilter/AgentAuthService/HwSigner/AgentPrincipal`；`WebConfig` 注册 filter 到 `/agent/blog/**`，`UserContextInterceptor` 排除 `/agent/**`。
2. `BlogUserService` 加 `getOrCreateByDomain`。
3. 新增 `module/agent/controller`：`BlogAgentController`、`CommentAgentController`、`DraftAgentController`、`UserAgentController`、`FileAgentController`、`ShowAgentController`（含 DTO 适配）。
4. `BlogServiceImpl.saveBlog` 新建分支接积分事件（M4）。
5. Flyway `V4`（身份）；管理面权限表 `V5`（见 §5.5）。
6. `/agent/*` 接入 `RateLimitUtil`；`blog_create` 幂等。

---

## 5. 管理面后端（合并进 hdblogservice）

> **v1.1 核心变化**：不再有独立 `hdblogmngservice`。现有管理台 UI 走 `/manage/**`（`AuthInterceptor` + `TokenService`，Redis TTL 120min）；Agent 管理面新增 `/agent/admin/*`，**同进程**复用相同 `TokenService`/审计逻辑。

### 5.1 认证

- 复用现有 `AuthController(/manage/auth/login)`、`TokenService`（Redis，TTL 120min）、`AuthInterceptor`、`AdminContext{id,username,nickName}`、`CurrentAdminHolder`。
- **新增** `AgentAdminInterceptor`（拦 `/agent/admin/**`，Bearer token → request attribute），或复用 `AuthInterceptor` 扩展路径。
- **新增** `POST /agent/admin/login`（返回 `{token, user:{id,username,nick_name,role}}`）与 `POST /agent/admin/logout`，逻辑复用 `TokenService.issue/revoke`。
- 废弃默认明文口令 `admin/123456`（生产强制改密）。**待确认**：内部登录是否纳入统一 SSO/更严密码策略。

### 5.2 管理面 Agent 聚合接口契约

**context-path**：`/api/v1/blogservice`，Agent 前缀 `/agent/admin/*`。复用现有 `ApiResponse`。

| # | 方法 路径 | 请求 | 响应 data | 复用现有实现 |
|---|---|---|---|---|
| 1 | POST `/agent/admin/blog/review` | `{id, action:'approve'\|'reject', reason?}` | `null`（写 `hd_blog_review_record`） | `BlogManageController.doReview` |
| 2 | POST `/agent/admin/blog/review/batch` | `{ids:[], action, reason?}` | `{affected, batch_no}` | `BlogManageController.reviewBatch` |
| 3 | POST `/agent/admin/blog/online` | `{id, online:0\|1}` | `null` | `BlogManageController.online` |
| 4 | POST `/agent/admin/blog/top` | `{id, top:0\|1}` | `null` | `BlogManageController.top` |
| 5 | GET `/agent/admin/blog/page` | `page_no page_size status online keyword` | `{total, page_no, page_size, list:[BlogVO]}` | `BlogManageController.page` |
| 6 | POST `/agent/admin/comment/review` | `{id, action, reason?}` | `null` | `CommentManageController` |
| 7 | POST `/agent/admin/comment/review/batch` | `{ids, action, reason?}` | `{affected}` | `CommentManageController` |
| 8 | POST `/agent/admin/comment/online` | `{id, online}` | `null` | `CommentManageController` |
| 9 | GET `/agent/admin/comment/page` | 同上分页 | `{total,list:[CommentVO]}` | `CommentManageController` |
| 10 | GET `/agent/admin/stats` | — | `{blog:{pending,approved,rejected,online,top}, comment:{pending,approved,rejected,online}}` | `StatsController` |
| 11 | GET `/agent/admin/blog/{id}/records` | `page_no page_size` | `{total,list:[ReviewRecord]}` | `BlogManageController.records` |
| 12 | POST `/agent/admin/login` | `{username,password}` | `{token, user:{id,username,nick_name,role}}` | `AuthController.login`（扩展 role） |
| 13 | POST `/agent/admin/logout` | header Bearer | `null` | `AuthController.logout` |

> 审查动作（review/online/top）直接复用现有 `BlogService`/`BlogManageController` 逻辑（含审计记录 `hd_blog_review_record`/`hd_blog_comment_review_record`）。

### 5.3 权限：预制表 + 角色清单

**表结构（hdblogservice，Flyway `V5__admin_rbac.sql`）：**

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
  tool_name VARCHAR(64) NOT NULL,            -- MCP 工具名（§2.3.2）
  allow TINYINT DEFAULT 1,
  UNIQUE KEY uk_role_tool (role, tool_name)
);
```

**白名单粒度**：`tool_name` = MCP 工具名（`hdcommunity_admin_*`）。校验在 `/agent/admin/*` 入口：请求携带工具语义名 → 后端按 `role→tool` 判定；或后端按接口路径映射到工具名。

**默认角色清单（占位）：**

| 角色码 | 名称 | 允许工具 |
|---|---|---|
| `super_admin` | 超级管理员 | 全部 `admin_*` |
| `blog_reviewer` | 博客审核员 | `admin_blog_page/review/review_batch/online/top/stats/blog_records` |
| `comment_reviewer` | 评论审核员 | `admin_comment_page/review/review_batch/online/stats` |
| `readonly_ops` | 只读运营 | `admin_blog_page/admin_comment_page/admin_stats` |

- 预制表本期由 DBA/脚本维护；未命中 operator 的账号默认拒绝所有 `admin_*`（`FORBIDDEN`/`ADMIN_ROLE_DENIED`）。

### 5.4 错误码

沿用现有 `ErrorCode`（`UNAUTHORIZED(10001,401)`、`FORBIDDEN(10002,403)`…）+ 新增 `ADMIN_ROLE_DENIED(见 §6.1)`、复用 `COMMENT_NOT_FOUND(20003,400)`。

### 5.5 数据模型变更（hdblogservice）

- 新增 `hd_community_operator`、`hd_community_role_tool`（见 §5.3，Flyway `V5`）。
- `hd_blog_admin_user` 可选加 `role` 字段（简化单角色方案，与 `hd_community_operator` 二选一；本规格以独立表为准）。

### 5.6 改造清单（hdblogservice）

1. 新增 `module/agent/controller`：`BlogAdminAgentController`、`CommentAdminAgentController`、`StatsAgentController`、`AuthAgentController`。
2. `AgentAdminInterceptor` 拦 `/agent/admin/**`（Bearer → request attribute）。
3. `RolePermissionService`：读 `hd_community_operator` + `hd_community_role_tool`，按工具名判定。
4. Flyway V5（权限表）。
5. `AuthController` 扩展返回 `role`；新增 `/agent/admin/login|logout`。

---

## 6. 附录

### 6.1 错误码总表（对齐现有 enum，避免编号冲突）

现有（不可改，被 Web/管理台使用）：`UNAUTHORIZED(10001,401)`、`FORBIDDEN(10002,403)`、`AUTH_FAILED(10003,401,"账号或密码错误")`、`NOT_FOUND(10004,404)`、`PARAM_ERROR(20000,400)`…`RATE_LIMITED(30001,429)`、`SYSTEM_ERROR(90000,500)`。

**新增（建议 11xxx 段，避免与现有冲突）：**

| code | 值 | HTTP | 场景 |
|---|---|---|---|
| `AUTH_AK_MISSING` | 11001 | 400 | 用户面缺 `X-HW-AK` |
| `AUTH_SK_MISSING` | 11002 | 400 | 用户面缺 `X-HW-SK` |
| `AGENT_AUTH_FAILED` | 11003 | 401 | AK/SK 无效或 IAM 认证失败 |
| `DOMAIN_NOT_WHITELISTED` | 11004 | 403 | 账号不在白名单（预留） |
| `ADMIN_ROLE_DENIED` | 11005 | 403 | 管理面角色无工具权限 |

- `RATE_LIMITED` 复用 `30001`。
- **Toolkit 需同步改**：`src/errors.mjs` 中 `BACKEND.ADMIN_ROLE_DENIED` 由 `10003` 改为 `11005`（否则会把角色拒绝误判为账密错误）。

### 6.2 数据模型变更总表

| 表/变更 | 服务 | Flyway | 说明 |
|---|---|---|---|
| `hd_blog_user` +2 字段 +1 唯一索引 | hdblogservice | V4 | `hcloud_domain_id/name` |
| `hd_community_operator` 新增 | hdblogservice | V5 | 内部账号 → 角色 |
| `hd_community_role_tool` 新增 | hdblogservice | V5 | 角色 → 工具白名单 |
| `hd_points_retry` 新增 | hdblogservice | V6 | 发积分失败重试（M4） |
| `hd_blog_admin_user` +`role`（可选） | hdblogservice | — | 简化单角色方案（本期不用） |

### 6.3 待确认项（开工前需业务回答）

| # | 待确认 | 影响 |
|---|---|---|
| 1 | Web 端 devdata 的 uid 是 IAM 用户级还是账号级 | §4.2 身份合并策略 |
| 2 | 发博客积分的 `mission_info.id`（任务码） | §4.5 |
| 3 | 体验官上报接口地址/契约 | §3.4 |
| 4 | 管理面默认角色清单是否采纳 §5.3 占位 | §5.3 |
| 5 | 生产后端域名/环境（`HDCOMMUNITY_BASE`） | §1.6 |
| 6 | 内部登录是否纳入统一 SSO/密码策略 | §5.1 |
| 7 | 是否要补 Toolkit `remote` 传输 / `find_skill` / `search_docs` | §2.10 / §3.5 |

### 6.4 里程碑映射

| 里程碑 | 交付 | 对应章节 |
|---|---|---|
| M1 (=I1/P0) | Toolkit 壳（已落地）+ 用户面认证 + 20 接口 + `hd-blog-author` | §1/§2.3.1/§3/§4 |
| M2 (=I2/P1) | 管理面认证 + 13 接口 + 权限表（V5） + `hd-blog-operator` | §2.3.2/§5 |
| M3 (=P2) | 数据展示面 2 接口 + `hd-blog-promote` | §2.3.3/§3 |
| M4 (=P3) | 成长积分（V6）+ 体验官 skill | §3.4/§4.5 |

---

**评审重点**：§4.2 身份迁移（问题 1）、§5.3 角色清单（问题 4）、§2.6 token 会话（设计确认）、§1.6/§6.3-5 生产地址、§6.1 错误码重编号。确认后可按 M1 开工。