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
安装完成后我应能用这些能力（共 36 个 MCP 工具）：看/写/发/编辑/删除博客、草稿、评论、
点赞/收藏/关注、上传图片；管理面登录并审核博客与评论（审核前自动本地内容风控，标记风险不阻断）、
上下线、置顶、审核记录、工作台统计、内容风控检查；
对外公开只读的博客列表/详情。另含 4 个 Skill：hd-blog-author / hd-blog-operator /
hd-blog-promote / hd-experience。
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

---

## 配置

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `HDCOMMUNITY_BASE` | `https://opentest-dataset.huaweicloud.com/api/v1/blogservice` | 后端地址（用户面 + 管理面**合并**单服务） |
| `HDCOMMUNITY_ADMIN_LOGIN_PATH` | `/manage/auth/login` | 管理面登录路径 |
| `HDCOMMUNITY_ADMIN_LOGOUT_PATH` | `/manage/auth/logout` | 管理面注销路径 |
| `HW_REGION` | `cn-north-4` | 区域 |
| `HDCOMMUNITY_TIMEOUT_MS` | `30000` | 请求超时（毫秒） |

> 在 Agent 的 MCP 配置里通过 `env` 传入，例如把 `HDCOMMUNITY_BASE` 指向你的环境。

---

## 工具清单（共 36 个）

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

### 管理面（14）— 需内部登录（风控工具除外）

| 工具 | 作用 |
|---|---|
| `hdcommunity_admin_login` | 管理面登录（内部账号密码）→ token |
| `hdcommunity_admin_logout` | 注销（吊销 token） |
| `hdcommunity_admin_blog_page` | 博客分页（按状态/上线/关键词筛选） |
| `hdcommunity_admin_blog_review` | 单条审核（`approve` / `reject` + 意见；传 `title`/`content` 自动风控） |
| `hdcommunity_admin_blog_review_batch` | 批量审核（传 `items:[{id,title,content}]` 逐条自动风控） |
| `hdcommunity_admin_blog_online` | 博客上线 / 下线 |
| `hdcommunity_admin_blog_top` | 博客置顶 / 取消 |
| `hdcommunity_admin_blog_records` | 博客审核记录 |
| `hdcommunity_admin_comment_page` | 评论分页 |
| `hdcommunity_admin_comment_review` | 评论审核 |
| `hdcommunity_admin_comment_review_batch` | 评论批量审核 |
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

1. 登录：`hdcommunity_admin_login { username, password }` → token 会话缓存。
2. 取待审：`hdcommunity_admin_blog_page { status: 1, page_no: 1, page_size: 10 }`。
3. 审核（**审核前自动本地内容风控，标记风险不阻断**）：
   - 单条：`hdcommunity_admin_blog_review { id, action: "approve" | "reject", remark?, title?, content? }`
     — 传入待审博客的 `title`/`content`（来自上一步分页/详情），响应附带 `risk_check`
     （`risk_level` / `categories` / `hits` / `suggestion`），供管理员决策参考。
   - 批量：`hdcommunity_admin_blog_review_batch { ids: [...], action, remark?, items?: [{id,title,content}] }`
     — 响应附带逐条 `risk_check.items` 与 `overall_risk_level` 汇总。
   - 独立检查：`hdcommunity_admin_blog_risk_check { title?, content? }`（本地纯计算，无需登录）。
   - 风控词库：内置种子词库 + 可扩展文件 `~/.config/hdcommunity-toolkit/risk-words.json`
     （或环境变量 `HDCOMMUNITY_RISK_WORDS_FILE`，支持 `"词"` 或 `{"word","category","level"}` 条目，
     可接入社区开源词库数据；免费方案，无云端依赖）。图片风控为二期规划。
4. 上线 / 置顶：
   - `hdcommunity_admin_blog_online { id, online: 1 }`（仅已通过可上下线）
   - `hdcommunity_admin_blog_top { id, top: 1 }`（仅已通过且已上线可置顶）
5. 审计：`hdcommunity_admin_blog_records { id, page_no, page_size }`。
6. 评论审核：`hdcommunity_admin_comment_page { status: 1 }` → `hdcommunity_admin_comment_review(_batch)` → `hdcommunity_admin_comment_online`。
7. 汇报：`hdcommunity_admin_stats`。
8. 注销：`hdcommunity_admin_logout`。

### 三、评论与社交（用户面）

- 评论：`hdcommunity_comment_add { blog_ref, content, parent_id? }` → 进入待审核；`hdcommunity_comment_list { id }` 查看。
- 点赞/收藏/关注：`hdcommunity_blog_vote` / `hdcommunity_blog_favorite` { ref, operation_type: 1|0 }、`hdcommunity_blog_follow` { author_uid, operation_type }。

### 四、对外只读 / 推广（无需登录）

外部 Agent 直接读公开数据，用于生成各平台（如 B站）推广文案：

- `hdcommunity_show_blog_list { page_no, page_size, key_word }`
- `hdcommunity_show_blog_detail { ref }`

---

## 内置 Skill

| Skill | 用途 |
|---|---|
| `hd-blog-author` | 开发者「写 → 发 → 查审核 → 看数据」（HTML 正文、绝对图片地址） |
| `hd-blog-operator` | 运营「待审清理 / 内容巡检」 |
| `hd-blog-promote` | 博客 → 各平台推广文案 |
| `hd-experience` | 体验案例上报（skill 直调体验官服务接口） |

---

## 开发

```bash
npm install
npm run smoke   # 协议层冒烟（无需网络）
npm start       # 启动 MCP server（stdio）
```

## 文档

- [设计方案](docs/hdcommunity-toolkit-design.md)
- [实现规格 / 接口契约](docs/hdcommunity-toolkit-实现规格.md)
- [迭代计划](docs/hdcommunity-toolkit-迭代计划.md)

## 许可

Apache-2.0