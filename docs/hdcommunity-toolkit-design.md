# HDCommunityToolkit 华为云社区业务 Agent 工具包 — 设计方案（定稿）

> 日期：2026-10-19 ｜ 状态：评审中 ｜ 版本：v0.11

---

## 1. 背景与目标

华为云社区业务（蓝区 IT 平台，互联网生产环境）需适应 Agent 时代，让**开发者**与**运营**都能通过 AI 编码助手（opencode / codex / 码道等）操作社区业务。

- **形态**：一个工具包 `hdcommunity-toolkit`，内含多业务系统的 MCP + Skill，**独立包发布**。
- **业务范围**：首批接入博客；成长体系 / 大赛 / 活动按统一扩展框架后续接入（见 §2.3）。
- **登录**：用户面走华为云账户登录（AK/SK → IAM 换账号身份，登录互通）；管理面沿用原有内部登录。

## 2. 总体架构

### 2.1 分层

```
Agent (opencode/codex/码道...)
  │  npx hdcommunity-toolkit-mcp
  ▼
┌────────────────────────────────────────────────┐
│ hdcommunity-toolkit（独立包，本地 MCP server）      │
│  ├─ 认证底座（用户面复用 devkit 三源凭证模型）      │
│  ├─ 管理面登录工具（内部账号密码 → token）          │
│  ├─ 社区业务 MCP 工具（薄封装，调后端聚合接口）      │
│  └─ 社区 Skill（写博客/审核/推广/体验官）           │
└────────────────────────────────────────────────┘
  │  用户面：X-HW-AK / X-HW-SK（华为云 AK/SK）        │
  │  管理面：Bearer token（原有内部登录）             │
  ▼
┌────────────────┬─────────────────────────────────┐
│ hdblogservice  │ hdblogmngservice                 │
│ 用户面          │ 管理面                           │
│ + AK/SK认证Filter│ + 内部登录(原有) + 预制表权限      │
│ + Agent聚合接口 │ + Agent聚合接口                   │
└────────────────┴─────────────────────────────────┘
  ▲  用户面：AK/SK → IAM /v3/auth/domains → domainId（照 hdopenservice）
     管理面：沿用原有账号密码登录 → token（不走华为云 AK/SK）
```

### 2.2 关键决策

| 决策 | 结论 | 理由 |
|---|---|---|
| 网关形态 | **直连 + 认证抽离**（不建业务聚合网关） | 后端少、够用 |
| 身份认证（用户面） | 照 `hdopenservice` 的 `AgentAuthFilter + AgentAuthService + HwSigner`（AK/SK → `GET /v3/auth/domains` → domainId） | 现成已验证、极简 |
| 身份认证（管理面） | **沿用原有内部登录**（账号密码 → token）；管理面 MCP 自带登录工具 | 复用内部能力，不引入 AK/SK |
| 身份粒度 | 用户面 **账号级**（`domain_id` 作社区账号主键） | 与参考实现、hdgrowth 积分一致 |
| 接口形态 | 不直接复用现有 REST，**新增 Agent 聚合接口** | MCP 工具只做薄封装 |
| 登录 | 用户面：华为云账户（AK/SK → domainId）；管理面：原有内部登录 | 用户走华为云、管理走内部 |
| 分发 | 独立 npm 包 | 业务聚焦，与 devkit 解耦 |
| 多业务接入 | 平台 + 业务能力包（统一底座复用，业务各自贡献工具/skill/接口） | 见 §2.3 |

### 2.3 业务系统扩展框架（多业务接入）

hdcommunity-toolkit 按「统一底座 + 业务能力包」分层，博客只是首批接入，后续成长体系 / 大赛 / 活动按同一框架接入，不动底座。

```
hdcommunity-toolkit
├─ 统一底座（一次建设，全业务复用）
│   ├─ 认证：用户面 AK/SK → domainId；管理面内部登录（§3）
│   ├─ 分发：独立包 + npx（§9）
│   └─ MCP server 框架 + skill 检索（复用 devkit 机制）
└─ 业务能力包（每个业务系统各一份，工具包侧聚合）
    ├─ 博客（首批，见 §4-§8）
    ├─ 成长体系（横切能力，不单独立门户）
    ├─ 大赛（后续）
    └─ 活动（后续）
```

**命名空间规范**：

| 维度 | 规范 | 示例 |
|---|---|---|
| MCP 工具名 | `hdcommunity_<业务>_<动作>` | `hdcommunity_blog_create` / `hdcommunity_growth_reward` |
| Skill 目录 | `skills/<业务>/*/SKILL.md` | `skills/hd-blog-author/` / `skills/hd-competition-*` |
| 后端聚合接口 | `/agent/<业务>/*` | `/agent/blog/*` / `/agent/activity/*` |
| 数据表前缀 | 沿用各业务已有前缀 | `hd_blog_*` / `hd_activity_*` |

**接入新业务 X 的步骤**：

1. 业务后端新增 Agent 聚合接口 `/agent/X/*`（用户面复用 §3 的 AK/SK 认证三件套；管理面沿用内部登录）。
2. 工具包新增 MCP 工具组 `hdcommunity_X_*`（薄封装聚合接口）。
3. 工具包新增 skill `skills/hd-X-*/SKILL.md`。
4. （可选）管理面权限：在 §5 预制表补「角色 → X 工具」白名单。
5. （可选）激励：业务发领域事件 `X.submitted`，走 §8 成长积分。

**成长体系 = 横切能力**：成长积分跨业务（发博客/参赛/参加活动都得分），通过领域事件解耦，各业务发事件、统一调 `hdgrowthservice` 发积分，不作为独立门户接入（§8）。

## 3. 身份登录与认证（核心）

两条独立登录链路：**用户面走华为云 AK/SK，管理面沿用原有内部登录**。

### 3.1 认证链路

**用户面（开发者/客户）— 华为云 AK/SK（照 hdopenservice）**：

```
1. Agent 本地配置 AK/SK（auth init 唯一入口，复用 devkit）
2. 调后端 Agent 接口，请求头带：
      X-HW-AK（必）/ X-HW-SK（必）/ X-HW-Security-Token（可选）
      X-HW-PROJECT-ID（必）/ X-HW-REGION（可选，默认 cn-north-4）
      默认直接用永久 AK/SK；仅当凭证本身是 STS 临时凭证时才附带 SecurityToken（永久/临时均支持，无额外换发环节）
3. 后端 Agent 认证 Filter 用 HwSigner（SDK-HMAC-SHA256）签名
      调 IAM GET /v3/auth/domains → domains[0].id = domainId + name
4. domainId 以「认证结果」为准（不信任 body 原始值）→ 用户面 getOrCreate 建档
```

**管理面（运营/管理员）— 原有内部登录，不用 AK/SK**：

```
1. 管理面 MCP 单独提供登录工具 hdcommunity_admin_login(username, password)
      → 调后端原有登录接口 /admin/auth/login → token
2. 后续管理面工具携带 Bearer token 调后端（Authorization: Bearer <token>）
3. 后端沿用原有 AuthInterceptor + TokenService（Redis）校验 token
```

### 3.2 用户面参考实现（直接照抄 3 个类）

| 类 | 职责 | 参考文件 |
|---|---|---|
| `AgentAuthFilter` | Servlet Filter 拦 `/agent/*`，校验请求头，调 AuthService，同步/失败 401 | `openservice/.../config/AgentAuthFilter.java` |
| `AgentAuthService` | 用 HwSigner 签名调 `GET /v3/auth/domains`，取 `domains[0].id/name` | `openservice/.../service/AgentAuthService.java` |
| `HwSigner` | SDK-HMAC-SHA256 签名（支持 securityToken） | `openservice/.../util/HwSigner.java` |

> 关键点：agent 认证是「机器认证」，只取到 `domainId + domainName`（账号级，无 userId）；认证结果覆盖 body 里的身份字段（防伪造）。

### 3.3 用户面身份字段（账号级）

| 字段 | 来源 | 用途 |
|---|---|---|
| `hcloud_domain_id` | IAM `/v3/auth/domains` 的 `domains[0].id` | 社区账号主键（唯一索引） |
| `hcloud_domain_name` | `domains[0].name` | 展示 |

> 一个华为云账号 = 一个社区用户；同一账号下所有 IAM 子用户共享同一社区身份。

### 3.4 安全要求

- 用户面：AK/SK 通过 TLS 传输、日志脱敏（`ak.slice(0,8)***`）；SK 不落库；不信任客户端自报身份，后端以 IAM 认证结果为唯一权威。（可选优化：按 AK hash 缓存 domainId 到 Redis，降低调 IAM 频率。）
- 管理面：沿用内部登录 token（Redis，TTL 120min）；token 不落日志；废弃明文默认口令（`admin/123456`）。

## 4. 博客 Agent 友好设计（首个接入业务；三个 MCP 面 + Skill）

### 4.1 用户面 MCP（`hdcommunity_blog_*`）

| 工具 | 说明 |
|---|---|
| `blog_list` | 看博客（分页/搜索，仅已上线） |
| `blog_detail` | 看详情 |
| `blog_create` / `_update` | 写/发（进待审核） |
| `blog_delete` | 删（仅作者） |
| `draft_list/save/delete` | 草稿 |
| `comment_list/add/edit/delete` | 两级评论 |
| `blog_vote` / `blog_favorite` / `blog_follow` | 社交 |
| `user_profile` / `user_stat` | 个人统计 |
| `file_upload` | 图片（写博客必需） |

### 4.2 管理面 MCP（`hdcommunity_admin_*`，含独立登录）

| 工具 | 说明 |
|---|---|
| `admin_login` | **单独提供的登录工具**：内部账号密码 → token（沿用原有内部登录，不用 AK/SK） |
| `admin_blog_page` | 按状态筛选博客 |
| `admin_blog_review` / `_batch` | 审核 |
| `admin_blog_online` / `_top` | 上线/置顶 |
| `admin_comment_page/review/online` | 评论审核 |
| `admin_stats` | 工作台统计 |
| `admin_review_records` | 审核记录 |

> 管理面不走华为云 AK/SK：`admin_login` 登录后持有 token，其余管理面工具携带该 token 调用。

### 4.3 数据展示面 MCP（`hdcommunity_show_*`，对外公开只读）

| 工具 | 说明 |
|---|---|
| `show_blog_list` | 公开博客列表（无需登录 / 轻量 API Key） |
| `show_blog_detail` | 公开博客详情 |

> 定位：把博客的「列表/详情」能力以只读 MCP 对外提供，供外部各 Agent 读取；运营可据此生成文案到各平台（如 B站）推广，无需自动投稿对接。

### 4.4 Skill（高层工作流）

- `hd-blog-author`：写→提交→查审核→看数据，完整作者工作流。
- `hd-blog-operator`：每日待审清理 / 内容巡检。
- `hd-blog-promote`：博客 → 推广文案（供运营到各平台推广）。
- `hd-experience`：打包工具包使用过程 → 直接调体验官服务接口上报。

### 4.5 后端 Agent 聚合接口（新增，核心改造）

面向 Agent 新增语义化接口（`/agent/*`），MCP 工具薄封装它（不直接暴露现有内部 REST）：

1. 用户面：`认证 Filter + AuthService + HwSigner` 三件套（照 hdopenservice，抽成可复用公共模块，各业务用户面后端共用）；管理面：沿用原有内部登录拦截器（`AuthInterceptor + TokenService`）。
2. `hd_blog_user` 加 `hcloud_domain_id / hcloud_domain_name` + 迁移脚本。
3. 用户面新增 Agent 聚合接口（如 `GET/POST /agent/blog/*`）。
4. 管理面新增 Agent 聚合接口（`/agent/admin/*`），沿用原有内部登录（账号密码 → token）。
5. 数据展示面新增公开只读聚合接口（`/agent/show/*`，或独立公开网关）。

## 5. 管理面权限（预制表）

管理面沿用原有内部登录账号（`hd_blog_admin_user`），在其上做角色与工具白名单：

```
hd_community_operator(admin_username PK, role, status)   # 内部账号 → 角色
hd_community_role_tool (role, tool_name, allow)          # 角色 → 工具白名单
```

- 机制：内部登录（账号密码 → token）→ 账号 → 查角色 → 按 `role→tool` 白名单放行管理面 MCP 工具。
- **角色清单单独设计**（本方案只保证「角色」能力存在、可配置、可扩展；不为具体角色划分拍板）。
- 预制表维护人/入口在设计角色清单时一并确定。

## 6. 运营管理台（只提供能力，不交付门户）

我方**只提供管理能力**（MCP 工具 + Agent 聚合接口），**不再提供正式门户**：

- **能力侧（正式交付）**：§4.2 管理面 MCP + §4.5 管理面 Agent 聚合接口，保证原子、可组合。
- **展示侧（不正式交付）**：现有 `hdblogmngportal` 仅作**参考实现/示例**，演示如何消费上述能力，不作为正式商用门户。
- **运营界面**：由运营通过 MCP 让 Agent 按需自行构建，展示形式不限（Web / 报表 / 看板 / 对话式）。

> 边界：能力下沉、展示层外置。交付物是「能力」，门户仅为可选参考，不承诺商用维护。

## 7. 体验官（skill 直调，后台不存储）

体验案例上报由工具包侧 **skill 直接调体验官服务接口**完成，我们后端（hdblogservice/hdblogmngservice）不存储任何体验官数据：

```
skill hd-experience
  1. 打包「用户面使用工具包的过程」为体验案例（title / description / steps[] / evidence{}）
  2. 直接 fetch 体验官服务接口（参照 submit.mjs，认证照 §3 带 X-HW-AK / X-HW-SK）
  3. 结果直接返回 Agent，不落我们后端库
```

- 上报接口待对方提供（见 §12）；skill 形态为纯工具包侧脚本（类似 `submit.mjs`）。

## 8. 成长中心积分（横切能力，有参考实现）

> 定位：跨业务系统的积分通道（发博客/参赛/参加活动都得分），非独立业务系统（见 §2.3）。

对接 `hdgrowthservice` 的 `receive-reward` 接口（参考 `openservice/.../GrowthServiceClient.java`）：

```
POST hdgrowthservice/receive-reward
header: X-APIG-APPCODE / X-HW-ID / X-HW-APPKEY / X-auth-token（IAM 账密换，Redis缓存提前10min刷新）
body: {
  domain_id, account_name,
  type: 1, source_ecology_type: 10,
  mission_info: [{ id, commit_time, source }]
}
```

- 触发点：`blog_create` 成功 → 调 `receive-reward` 发积分。
- 失败重试：`PointsRetryJob` + `hd_points_retry` 表（参考 openservice 同名实现）。
- 认证开关：测试环境走 `GROWTH_AUTH_TOKEN`，现网走 IAM 账密动态换 `X-Subject-Token`。

## 9. 工具包打包与分发（独立包）

- 独立 npm 包发布。
- bin：`hdcommunity-toolkit`（CLI 安装器）+ `hdcommunity-toolkit-mcp`（MCP server）。
- 一条 `npx` 接入；目标 agent 范围复用 devkit 的 11 种 target。
- 认证底座复用 huaweicloud-devkit（依赖引入其 auth 模块，实施时定细节）。

## 10. 数据模型变更汇总

| 变更 | 说明 | 归属服务 |
|---|---|---|
| `hd_blog_user` 加 2 字段 | `hcloud_domain_id`(唯一) + `hcloud_domain_name` | hdblogservice（用户面） |
| 新增 `hd_community_operator` | 内部登录账号 → 角色 | hdblogmngservice（管理面） |
| 新增 `hd_community_role_tool` | 角色 → 工具白名单 | hdblogmngservice（管理面） |
| 新增 `hd_points_retry` | 发积分失败重试（照 openservice） | hdblogservice（用户面） |

## 11. 分阶段路线图

| 阶段 | 内容 | 验收 |
|---|---|---|
| **P0 底座** | 复用 devkit 认证 + Agent 认证三件套（照 hdopenservice）+ 用户面 Agent 聚合接口/MCP | 能「看/写/发/评」博客 |
| **P1 管理面** | 内部登录（管理面 MCP 登录工具）+ 预制表 + 管理面聚合接口/MCP + 审核 skill | 运营 Agent 登录并审核 |
| **P2 开放** | 数据展示面公开只读 MCP + 推广 skill | B站/外部可读 |
| **P3 生态** | 成长积分对接 + 体验官 skill 上报 | 发博得积分；体验案例上报 |

## 12. 业务能力迭代计划（对齐绿区）

对比绿区（生产完整版）接口清单，本地简化版覆盖约 **1/3 业务域**；按「Agent 友好价值」分批补齐（完整差异矩阵见 `hdcommunity-toolkit-迭代计划.md`）：

| 迭代 | 主题 | 覆盖业务域 | 对应阶段 |
|---|---|---|---|
| **I1** | 工具包底座 + 用户面核心 | 博客、评论、草稿、用户、图片 | P0 |
| **I2** | 管理面审核 | 内容审核、上下线、置顶、统计 | P1 |
| **I3** | 内容组织 | 标签体系、专栏体系 | 新增 |
| **I4** | 内容发现 | 推荐、周/月榜单、统计增强 | 新增 |
| **I5** | 成长与事件 | 成长记录、内容积分/统计事件 | P2-P3 |
| **I6** | 治理与安全 | 内容安全(Scas)、举报管理、驳回记录、文章排序 | 新增 |
| **I7** | 运营装配 | Banner、Block、专题、广告、爬虫配置 | 评估 |
| **I8** | 平台配置 | 服务配置、AsyncTask | 评估 |

- **每迭代统一产出**：业务后端 Agent 聚合接口 `/agent/<域>/*` + 工具包 MCP 工具组 `hdcommunity_<域>_*` + skill。
- **取舍原则**：高频、适合对话的优先（博客/评论/标签/专栏/审核/榜单/成长）；配置型（Banner/Block/专题/广告/爬虫/服务配置）图形化后台更合适，Agent 化收益待评估。

## 13. 待定项（外部依赖，不阻塞当前）

| # | 待定 | 影响 |
|---|---|---|
| 1 | 体验官上报接口（对方未提供） | §7 skill 直接对接 |
| 2 | 预制表角色清单 + 维护人 | §5 单列设计 |