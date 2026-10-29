# HDCommunityToolkit

华为云社区业务的 **Agent 工具包** —— 一个插件内含多组 **MCP 工具 + Skill**，让 AI 编码助手（opencode / codex / 码道 等）以自然语言完成社区博客的**写作发布**、**内容审核**、**对外只读数据**等操作。

- 用户面：开发者看博客、写/发博客、评论、点赞/收藏/关注、草稿、上传图片
- 管理面：运营登录、博客/评论审核、上下线、置顶、审核记录、工作台统计
- 数据展示面：无需登录的公开只读博客列表/详情（供外部 Agent 读取、B站等平台推广）

> 本包为**端侧（工具包）**实现。接口契约见 `docs/hdcommunity-toolkit-实现规格.md`。

---

## 安装

**要求**：Node.js ≥ 22。

### 让 Agent 帮你安装（推荐：把下面提示词复制给你的 AI 编码助手）

```
请帮我安装「华为云社区 Agent 工具包 hdcommunity-toolkit」，步骤：
1. 运行：npx --yes hdcommunity-toolkit install --target all
   （按你使用的助手替换 --target：opencode / codex / codex-desktop / codearts /
     codearts-work / workbuddy / dsh / hermes / openclaw / atomcode / all）
2. 运行 npx --yes hdcommunity-toolkit status 确认安装结果，并告诉我装了几个 skill、写入了哪个 MCP 配置。
3. 提醒我：安装后需要「重启当前会话」才能加载新工具与 Skill。
4. 提醒我配置用户面 AK/SK（三选一）：
   - 环境变量 HW_ACCESS_KEY / HW_SECRET_KEY（可选 HW_SECURITY_TOKEN）
   - 写入 ~/.config/huaweicloud/credentials.json：
     {"ak":"<AK>","sk":"<SK>","securityToken":"","region":"cn-north-4"}
   - 若已安装 huaweicloud-devkit：运行 npx --yes huaweicloud-devkit auth init
安装完成后我应能用这些能力（共 66 个 MCP 工具）：看/写/发/编辑/删除博客、草稿、评论、
点赞/收藏/关注、上传图片；管理面登录并审核博客与评论（审核前自动本地内容风控，标记风险不阻断；401 自动重登；批量条件过滤 + dry_run 预览 + 按 id 回执）、
上下线、置顶、审核记录、工作台统计、内容风控检查；
对外公开只读的博客列表/详情。**成长中心（HDGrowService）**：公开只读的任务/分类/权益列表、
业务侧发积分/查积分/发券/兑换（涉钱写操作默认预演 + 确认令牌 + 高风险阈值）；
**成长中心管理台**：内部账号登录 + 涉钱配置变更单（草案/确认/分级审批/生效/回滚）、任务/权益/白名单查询、记录审计、统计看板。
另含 6 个 Skill：hd-blog-author / hd-blog-operator / hd-blog-promote / hd-experience / hd-grow-operator / hd-grow-admin。
```

> **极简版（一行提示词）**：
>
> `请阅读 https://github.com/huaweicloud-mate/hdcommunity-toolkit ，帮我安装这个社区 Agent 工具包，并配好 AK/SK（没有就复用 devkit 的）。`

### 手动安装

```bash
# 安装到指定 Agent（缺省 opencode）
npx hdcommunity-toolkit install --target opencode

# 安装到全部支持的 Agent
npx hdcommunity-toolkit install --target all

# 查看安装状态 / 卸载
npx hdcommunity-toolkit status
npx hdcommunity-toolkit uninstall --target opencode

# 帮助
npx hdcommunity-toolkit help
```

支持的 `--target`：`opencode, codex, codex-desktop, codearts, codearts-work, workbuddy, dsh, hermes, openclaw, atomcode, all`

**安装后重启会话**，即可在 Agent 中使用本工具包的工具与 Skill。

### 通用 MCP 注册（任何支持 MCP 的 Agent）

无需预安装，`npx` 自动处理：

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

---

## 认证与凭证

| 面 | 认证方式 |
|---|---|
| 用户面（`hdcommunity_blog_*` / `draft_*` / `comment_*` / `user_*` / `file_*`） | **华为云 AK/SK**（每次请求头携带，后端经 IAM 换取账号身份） |
| 管理面（`hdcommunity_admin_*`） | **内部账号登录** `hdcommunity_admin_login` → token（会话内缓存，不传 AK/SK） |
| 数据展示面（`hdcommunity_show_*`） | **无需登录**（公开只读） |

用户面 AK/SK 读取来源（优先级从高到低）：

1. 环境变量 `HW_ACCESS_KEY` / `HW_SECRET_KEY` / `HW_SECURITY_TOKEN`
2. `~/.config/huaweicloud/credentials.json`（格式 `{ak, sk, securityToken}`）
3. `~/.hcloud/config.json`（KooCLI profile）

### 如何配置用户面 AK/SK

用户面工具每次调用都需要 AK/SK，按优先级任选一种配置：

**① 环境变量**（最快，适合容器/CI）

- 设置 `HW_ACCESS_KEY` / `HW_SECRET_KEY`（可选 `HW_SECURITY_TOKEN`）；
- 在 Agent 的 MCP 配置 `env` 里传入，或直接在 shell 中 export。
- ⚠️ 不要把生产 AK/SK 写进会提交到 git 的配置文件。

**② 统一凭据文件**（推荐，一次配置长期可用）

- 路径：`~/.config/huaweicloud/credentials.json`
  - Windows：`%USERPROFILE%\.config\huaweicloud\credentials.json`
- 内容：

  ```json
  { "ak": "<你的AK>", "sk": "<你的SK>", "securityToken": "", "region": "cn-north-4" }
  ```

- 若你已安装 **huaweicloud-devkit**，可直接用它生成该文件：

  ```bash
  npx --yes huaweicloud-devkit auth init
  ```

**③ KooCLI profile**（兜底）：`~/.hcloud/config.json`

> 配置完成后，可调用 `hdcommunity_user_stat` 或 `hdcommunity_blog_list` 验证身份是否生效（返回 `AUTH_MISSING` / `AUTH_FAILED` 即表示 AK/SK 缺失或无效）。

**管理面**不走 AK/SK：调用 `hdcommunity_admin_login { username, password }` 用内部账号登录即可（token 会在当前会话内缓存）。

**管理面 401 自动重登**（可选，推荐配置）：设置环境变量 `HDCOMMUNITY_ADMIN_USER` / `HDCOMMUNITY_ADMIN_PASS`（或在 `~/.config/huaweicloud/credentials.json` 中写入 `admin_user` / `admin_pass`），管理面工具遇登录态过期（401）会自动重登并重试一次；重登失败才返回 `NEED_LOGIN`（附配置指引）。

---

## 配置

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `HDCOMMUNITY_BASE` | `https://opentest-dataset.huaweicloud.com/api/v1/blogservice` | 后端地址（用户面 + 管理面**合并**单服务） |
| `HDCOMMUNITY_ADMIN_LOGIN_PATH` | `/manage/auth/login` | 管理面登录路径 |
| `HDCOMMUNITY_ADMIN_LOGOUT_PATH` | `/manage/auth/logout` | 管理面注销路径 |
| `HDCOMMUNITY_ADMIN_USER` / `HDCOMMUNITY_ADMIN_PASS` | 空 | 管理面账号（401 自动重登用；缺省回退 credentials.json 的 admin_user/admin_pass） |
| `HDCOMMUNITY_ADMIN_BLOG_DETAIL_PATH` | `/manage/blog/{id}/detail` | 管理面博客详情路径（后端 A3 契约，`{id}` 占位） |
| `HW_REGION` | `cn-north-4` | 区域 |
| `HDCOMMUNITY_TIMEOUT_MS` | `30000` | 请求超时（毫秒） |
| `HDGROW_BASE` | **必填（无默认）** | 成长中心服务地址，形如 `https://<网关>/api/v1/hdgrowservice`（已含 context-path）；未配置 → **`CONFIG_MISSING`** |
| `HDGROW_RISK_FACE_AMOUNT_MAX` | `100` | 发券单张面额高风险阈值（元），超阈值需 `confirm_high_risk` + `reason` |
| `HDGROW_RISK_QUANTITY_MAX` | `10` | 兑换单次券数量高风险阈值 |
| `HDGROW_TOKEN_TTL_MS` | `1800000` | 管理台登录令牌本地缓存 TTL（毫秒，默认 30min） |
| `HDGROW_ADMIN_ENABLED` | `true` | 设为 `0` 关闭 `hdgrow_admin_*` 工具组（默认开启） |

> 在 Agent 的 MCP 配置里通过 `env` 传入，例如把 `HDCOMMUNITY_BASE` / `HDGROW_BASE` 指向你的环境。
> 成长中心沿用博客分层：业务侧 `/agent/grow/**` 用 **AK/SK**（与博客一致）；管理台 `/agent/admin/grow/**` 用内部账号 **Bearer**（登录 `/manage/auth/login`）；展示面 `/agent/show/grow/**` 无鉴权。

---

## 工具清单（共 66 个）

### 用户面（20）— 需 AK/SK

| 工具 | 作用 |
|---|---|
| `hdcommunity_blog_list` | 看博客列表（分页/搜索，仅已上线） |
| `hdcommunity_blog_detail` | 看博客详情（含正文） |
| `hdcommunity_blog_create` | 写/发博客（提交后进入**待审核**） |
| `hdcommunity_blog_update` | 编辑博客（提交后重回待审核） |
| `hdcommunity_blog_delete` | 删除博客（仅作者本人） |
| `hdcommunity_blog_mine` | 我的博客（按状态筛选） |
| `hdcommunity_blog_favorites` | 我的收藏 |
| `hdcommunity_draft_list` | 草稿列表 |
| `hdcommunity_draft_save` | 保存草稿 |
| `hdcommunity_draft_delete` | 删除草稿 |
| `hdcommunity_comment_list` | 评论列表（两级） |
| `hdcommunity_comment_add` | 发表评论（进入**待审核**） |
| `hdcommunity_comment_edit` | 编辑评论 |
| `hdcommunity_comment_delete` | 删除评论 |
| `hdcommunity_blog_vote` | 点赞 / 取消点赞 |
| `hdcommunity_blog_favorite` | 收藏 / 取消收藏 |
| `hdcommunity_blog_follow` | 关注 / 取消关注作者 |
| `hdcommunity_user_profile` | 我的个人信息 |
| `hdcommunity_user_stat` | 我的统计（博客数/阅读/点赞） |
| `hdcommunity_file_upload` | 上传图片（封面/正文用，base64） |

### 管理面（15）— 需内部登录（风控工具除外）

| 工具 | 作用 |
|---|---|
| `hdcommunity_admin_login` | 管理面登录（内部账号密码）→ token |
| `hdcommunity_admin_logout` | 注销（吊销 token） |
| `hdcommunity_admin_blog_page` | 博客分页（按状态/上线/关键词筛选；待审最老优先 + 待审时长；正文摘要化 content_preview/content_length） |
| `hdcommunity_admin_blog_detail` | 博客审核详情（include_content 可控；含审核历史与 risk_flags；后端 A3 未就绪时自动降级组合并说明） |
| `hdcommunity_admin_blog_review` | 单条审核（`approve` / `reject` + 意见；传 `title`/`content` 自动风控） |
| `hdcommunity_admin_blog_review_batch` | 批量审核（ids 或 filter{status,keyword,author}；dry_run 预览；按 id 回执明细 + 失败自动重试一次；传 `items:[{id,title,content}]` 逐条自动风控） |
| `hdcommunity_admin_blog_online` | 博客上线 / 下线 |
| `hdcommunity_admin_blog_top` | 博客置顶 / 取消 |
| `hdcommunity_admin_blog_records` | 博客审核记录 |
| `hdcommunity_admin_comment_page` | 评论分页（待审最老优先 + 待审时长） |
| `hdcommunity_admin_comment_review` | 评论审核 |
| `hdcommunity_admin_comment_review_batch` | 评论批量审核（ids 或 filter；dry_run 预览；按 id 回执明细） |
| `hdcommunity_admin_comment_online` | 评论上线 / 下线 |
| `hdcommunity_admin_stats` | 工作台统计（待审/通过/驳回/上线/置顶） |
| `hdcommunity_admin_blog_risk_check` | 内容风控检查（本地词库，标记风险不阻断，无需登录） |

### 数据展示面（2）— 无需登录

| 工具 | 作用 |
|---|---|
| `hdcommunity_show_blog_list` | 公开博客列表 |
| `hdcommunity_show_blog_detail` | 公开博客详情 |

---

## 典型流程

### 一、发博客（开发者 · 用户面）

> 内容格式：正文 `content` 使用 **HTML**（暂不支持 Markdown）；图片/链接使用**完整绝对地址**（`HDCOMMUNITY_BASE` 的 origin + `file_upload` 返回的相对路径）。

1. （可选）上传封面：`hdcommunity_file_upload { name: "cover.png", content_base64: "..." }` → 得到图片 URL，转为绝对地址。
2. 发布：`hdcommunity_blog_create { title, content(HTML), intro?, cover_url? }` → 返回 `{ ref }`，状态进入**待审核**。
   ```html
   <h1>标题</h1>
   <p>正文，支持 <strong>粗体</strong>。</p>
   <p><img src="https://<host>/api/v1/blogservice/file/xxx.png" alt="图片" /></p>
   ```
3. 查状态：`hdcommunity_blog_detail { ref }` → `status`（`1` 待审 / `2` 通过 / `3` 驳回）；驳回原因见 `review_remark`。
4. 被驳回则编辑：`hdcommunity_blog_update { ref, title, content, ... }` → 重回待审核。
5. 我的统计：`hdcommunity_user_stat`。

### 二、评审 / 审核（运营 · 管理面）

1. 登录：`hdcommunity_admin_login { username, password }` → token 会话缓存（配置 `HDCOMMUNITY_ADMIN_USER/PASS` 后 401 自动重登，无需人工介入）。
2. 取待审：`hdcommunity_admin_blog_page { status: 1, page_no: 1, page_size: 10 }` → **最老待审优先**排序，每条带 `pending_duration` 待审时长；列表正文已摘要化（`content_preview` + `content_length`），不会被超长正文冲爆上下文。
3. 看详情：`hdcommunity_admin_blog_detail { id, include_content? }` → 完整正文（可控）+ 审核历史 + `risk_flags`（script/iframe/style 检测等）。
4. 审核（**审核前自动本地内容风控，标记风险不阻断**）：
   - 单条：`hdcommunity_admin_blog_review { id, action: "approve" | "reject", remark?, title?, content? }`
     — 传入待审博客的 `title`/`content`（来自上一步详情/分页），响应附带 `risk_check`
     （`risk_level` / `categories` / `hits` / `suggestion`），供管理员决策参考。
   - 批量（建议先 `dry_run` 预览核对；传 `items:[{id,title,content}]` 时响应附带逐条 `risk_check.items` 与 `overall_risk_level` 汇总）：
     ```jsonc
     // 预览：只返回 id + 摘要列表，不写库
     hdcommunity_admin_blog_review_batch { action: "approve", filter: { status: 1, keyword: "云原生" }, dry_run: true }
     // 确认后执行：回执按 id 给出每条成功/失败明细，失败项自动重试一次
     hdcommunity_admin_blog_review_batch { ids: [1, 2, 3], action: "approve" }
     ```
   - 独立检查：`hdcommunity_admin_blog_risk_check { title?, content? }`（本地纯计算，无需登录）。
   - 风控词库：内置种子词库 + 可扩展文件 `~/.config/hdcommunity-toolkit/risk-words.json`
     （或环境变量 `HDCOMMUNITY_RISK_WORDS_FILE`，支持 `"词"` 或 `{"word","category","level"}` 条目，
     可接入社区开源词库数据；免费方案，无云端依赖）。图片风控为二期规划。
5. 上线 / 置顶：
   - `hdcommunity_admin_blog_online { id, online: 1 }`（仅已通过可上下线）
   - `hdcommunity_admin_blog_top { id, top: 1 }`（仅已通过且已上线可置顶）
6. 审计：`hdcommunity_admin_blog_records { id, page_no, page_size }`。
7. 评论审核：`hdcommunity_admin_comment_page { status: 1 }` → `hdcommunity_admin_comment_review(_batch)` → `hdcommunity_admin_comment_online`。
8. 汇报：`hdcommunity_admin_stats`。
9. 注销：`hdcommunity_admin_logout`。

### 三、评论与社交（用户面）

- 评论：`hdcommunity_comment_add { blog_ref, content, parent_id? }` → 进入待审核；`hdcommunity_comment_list { id }` 查看。
- 点赞/收藏/关注：`hdcommunity_blog_vote` / `hdcommunity_blog_favorite` { ref, operation_type: 1|0 }、`hdcommunity_blog_follow` { author_uid, operation_type }。

### 四、对外只读 / 推广（无需登录）

外部 Agent 直接读公开数据，用于生成各平台（如 B站）推广文案：

- `hdcommunity_show_blog_list { page_no, page_size, key_word }`
- `hdcommunity_show_blog_detail { ref }`

---

## 成长中心（HDGrowService，共 9 个）

与博客平行的一段能力，对接华为云开发者成长体系（`/api/v1/hdgrowservice`）。

### 公开只读（3）— 无需鉴权
| 工具 | 作用 |
|---|---|
| `hdgrow_task_list` | 成长中心任务列表（`GET /agent/show/grow/task/list`） |
| `hdgrow_task_categories` | 任务分类列表（`GET /agent/show/grow/task/categories`） |
| `hdgrow_prize_list` | 权益(代金券)列表（`GET /agent/show/grow/prize/list`） |

### 业务侧（6）— 需 AK/SK（`/agent/grow/**`）
| 工具 | 作用 |
|---|---|
| `hdgrow_points_query` | 查询用户积分（`/agent/grow/points/query`） |
| `hdgrow_server_tasks` | 业务侧任务列表（`/agent/grow/task/list`） |
| `hdgrow_server_prizes` | 业务侧权益列表（`/agent/grow/prize/list`） |
| `hdgrow_points_add` | **发放积分（写）** `/agent/grow/points/add` |
| `hdgrow_prize_exchange` | **兑换代金券（写）** `/agent/grow/prize/exchange` |
| `hdgrow_issue_coupon` | **发代金券（写）** `/agent/grow/issue-coupon` |

> **涉钱写操作安全防护**（`points_add` / `prize_exchange` / `issue_coupon`）：
> 1. 默认 `dry_run=true` **只预演不落库**，返回参数、金额、风险等级与 `confirm_token`；
> 2. 执行须传 `dry_run=false` + `confirm_token`（一次性、HMAC、TTL 5 分钟，**绑定请求体**，参数被改动即拒绝）；
> 3. 超阈值（`face_amount>100` 元 / `quantity>10`）须 `confirm_high_risk=true` + 非空 `reason`；
> 4. `issue_coupon`/`prize_exchange` 强制 `biz_id` 幂等；插件层**不自动重试**。
>
> > 运营「配置」侧（任务发放积分、券数量/面额等**设置项**）见下方「成长中心管理台」。

---

## 成长中心管理台（HDGrowService，共 20 个）

对接 `hdgrowservice` 的 `/agent/admin/grow/**`（登录/注销仍走真实路径 `/manage/auth/*`）。**内部账号登录**（Bearer token，非 AK/SK）。

### 认证（2）
`hdgrow_admin_login`（内部账号，角色 operator/approver/admin）· `hdgrow_admin_logout`

### 涉钱配置变更单（7）
| 工具 | 作用 |
|---|---|
| `hdgrow_admin_change_create` | 生成草案：diff / 金额影响 / 风险 + 一次性 `confirm_token`（**不落库**） |
| `hdgrow_admin_change_commit` | 提交人确认（`confirm_token` + `reason`）；LOW/MID→READY，HIGH→PENDING_APPROVAL |
| `hdgrow_admin_change_approve` | 审批人 approve/reject（HIGH 且 **approver ≠ submitter**） |
| `hdgrow_admin_change_apply` | 生效（写目标表） |
| `hdgrow_admin_change_revert` | 回滚（按 before 快照 / 新建则禁用/逻辑删除） |
| `hdgrow_admin_change_get` / `hdgrow_admin_change_page` | 详情 / 分页 |

> 涉钱配置**禁止直改**：任务积分、权益面额/库存/数量、白名单放权、用户积分调整，一律走变更流；阈值 HIGH 需双人审批。

### 查询 / 审计 / 统计（11）
`hdgrow_admin_task_page`/`_get` · `hdgrow_admin_prize_page`/`_get` · `hdgrow_admin_whitelist_page`
`hdgrow_admin_record_points`/`_exchange`/`_issue`/`_job` · `hdgrow_admin_user_page`
`hdgrow_admin_stats`（overview / stock / exchange_trend / task_distribution）

---

## 内置 Skill

| Skill | 用途 |
|---|---|
| `hd-blog-author` | 开发者「写 → 发 → 查审核 → 看数据」（HTML 正文、绝对图片地址） |
| `hd-blog-operator` | 运营「待审清理 / 内容巡检」 |
| `hd-blog-promote` | 博客 → 各平台推广文案 |
| `hd-experience` | 体验案例上报（skill 直调体验官服务接口） |
| `hd-grow-operator` | 成长中心运营/查询（看任务/权益、查积分、发积分/发券，涉钱写操作强制预演） |
| `hd-grow-admin` | 成长中心管理台（内部登录、涉钱配置变更单分级审批、任务/权益/白名单、记录审计、统计） |

---

## 开发

```bash
npm install
npm run smoke   # 协议层冒烟（无需网络）
node --test test/review-enhancements.test.mjs   # 单元测试（本地 fake 后端，无需外部网络）
npm start       # 启动 MCP server（stdio）
```

## 文档

- [设计方案](docs/hdcommunity-toolkit-design.md)
- [实现规格 / 接口契约](docs/hdcommunity-toolkit-实现规格.md)
- [迭代计划](docs/hdcommunity-toolkit-迭代计划.md)

## 许可

Apache-2.0
