# HDCommunity Toolkit

华为云社区业务的 **Agent 工具包** —— **用户面 + 展示面**（MCP 工具 + Skill），让 AI 编码助手以自然语言完成社区博客的**写/发/评论/互动**等操作。

> 本工具包只包含**普通用户**可看/可用的能力。

## 安装

**要求**：Node.js ≥ 22。

```bash
npx --yes hdcommunity-toolkit install --target opencode   # 或 codex / codearts / ... / all
npx --yes hdcommunity-toolkit status
npx --yes hdcommunity-toolkit uninstall --target opencode
```

安装后**重启会话**加载新工具/Skill。

## 认证

| 面 | 工具前缀 | 鉴权 |
|---|---|---|
| 社区用户面 | `hdcommunity_blog_*` / `draft_*` / `comment_*` / `user_*` / `file_*` | 华为云 **AK/SK**（`HW_ACCESS_KEY`/`HW_SECRET_KEY`） |
| 公开只读 | `hdcommunity_show_*` | 无 |
| 成长中心展示面 | `hdgrow_*`（任务/权益列表） | 无（公开只读） |
| 成长中心用户面 | `hdgrow_user_*`（我的积分/任务/兑换） | 华为云 **AK/SK**（网关注入身份，只能访问本人数据） |

AK/SK 读取优先级：环境变量 `HW_ACCESS_KEY`/`HW_SECRET_KEY` → `~/.config/huaweicloud/credentials.json` → `~/.hcloud/config.json`。

## 工具清单

### 社区用户面（`hdcommunity_*`）
博客：`blog_list` / `blog_detail` / `blog_create` / `blog_update` / `blog_delete` / `blog_mine` / `blog_favorites`；
草稿：`draft_list` / `draft_save` / `draft_delete`；
评论：`comment_list` / `comment_add` / `comment_edit` / `comment_delete`；
互动：`blog_vote` / `blog_favorite` / `blog_follow`；
用户：`user_profile` / `user_stat`；文件：`file_upload`。

### 公开只读（`hdcommunity_show_*`）
`show_blog_list` / `show_blog_detail`。

### 成长中心展示面（`hdgrow_*`）
公开只读（无鉴权）：`hdgrow_task_list` / `hdgrow_task_categories` / `hdgrow_prize_list`。

### 成长中心用户面（`hdgrow_user_*`，AK/SK）
我的：`user_info` / `user_tasks`（含完成状态）/ `user_prizes` / `user_points_detail` / `user_exchange_records`；
签到：`user_sign_in` / `user_sign_in_status`；
自助兑换：`user_prize_exchange`（涉钱，默认预演 + `confirm_token` + 强制 `biz_id`）。

## 配置（环境变量）

| 变量 | 默认 | 说明 |
|---|---|---|
| `HDCOMMUNITY_BASE` | `https://opentest-dataset.huaweicloud.com/api/v1/blogservice` | 社区服务地址 |
| `HDGROW_BASE` | 测试网关 `https://opctest-dataset.developer.huaweicloud.com/api/v1/hdgrowservice` | 成长服务地址（现网 `https://opc-dataset.developer.huaweicloud.com/api/v1/hdgrowservice`，可用环境变量覆盖） |
| `HW_REGION` | `cn-north-4` | 区域 |
| `HDGROW_RISK_QUANTITY_MAX` | `10` | 自助兑换单次数量高风险阈值 |

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
node --test     # 单元测试
npm start       # 启动 MCP server（stdio）
```

## 许可

Apache-2.0
