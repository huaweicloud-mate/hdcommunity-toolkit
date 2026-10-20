# HDCommunityToolkit

华为云社区业务 Agent 工具包 —— 向 AI 编码助手（opencode / codex / 码道 等）提供 MCP 工具 + Skill，支持博客的用户面写作、管理面审核、对外只读数据。

> 本包为**端侧（工具包）**实现。后端 Agent 聚合接口（用户面/管理面）为后续迭代，见 `hdcommunity-toolkit-实现规格.md`。

## 能力

| 面 | 工具前缀 | 认证 |
|---|---|---|
| 用户面 | `hdcommunity_blog_*` / `draft_*` / `comment_*` / `user_*` / `file_*` | 华为云 AK/SK（逐请求） |
| 管理面 | `hdcommunity_admin_*`（含 `admin_login`） | 内部账号登录 → token（会话缓存） |
| 数据展示面 | `hdcommunity_show_*` | 无（公开只读） |

## 快速开始

```bash
# 安装（默认 opencode；--target all 安装全部）
npx hdcommunity-toolkit install --target opencode

# 查看状态
npx hdcommunity-toolkit status
```

安装后**重启会话**。

### 通用 MCP 注册

任何支持 MCP 的 Agent：

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

## 凭证

用户面工具从以下来源读取 AK/SK（优先级从高到低）：

1. 环境变量 `HW_ACCESS_KEY` / `HW_SECRET_KEY` / `HW_SECURITY_TOKEN`
2. `~/.config/huaweicloud/credentials.json`（devkit 统一凭据库，格式 `{ak, sk, securityToken}`）
3. `~/.hcloud/config.json`（KooCLI profile）

管理面工具用内部账号登录（`hdcommunity_admin_login`），不走 AK/SK。

## 配置

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `HDCOMMUNITY_BASE` | `http://127.0.0.1:8080/api/v1/blogservice` | 后端（用户面 + 管理面**合并**单服务） |
| `HDCOMMUNITY_ADMIN_LOGIN_PATH` | `/manage/auth/login` | 管理面登录路径 |
| `HDCOMMUNITY_ADMIN_LOGOUT_PATH` | `/manage/auth/logout` | 管理面注销路径 |
| `HW_REGION` | `cn-north-4` | 区域 |

## Skill

- `hd-blog-author` — 开发者写作/发布
- `hd-blog-operator` — 运营审核
- `hd-blog-promote` — 内容推广文案
- `hd-experience` — 体验官案例上报

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