# Changelog

## 0.8.4

### Fixed
- parseArgs 支持 `--target=<value>` 等号形式，空值/非法值不再静默回退自动检测（#32，PR #33）。

## 0.8.3

### Fixed
- GitCode 登录回环回调端口竞态与 Windows 打开 URL 丢 state（#31，PR #31）。

## 0.8.2

### Fixed — GitCode 登录
- 回环回调服务未等待 `listening` 就读取端口，`hdcommunity_auth_login` 直接抛 `TypeError`（`server.address()` 为 null）。
- Windows 打开浏览器改用 PowerShell `Start-Process`：原 `cmd /c start` 会把 URL 里的 `&` 当命令分隔符，丢失 `state`，后端报“缺少 state”。
- 新增回环回调服务单测（端口就绪、ticket 解析、state 校验）。

## 0.8.1

### Fixed — dsh 安装遗留
- `install --target dsh` 不再要求/写入 `HDGROW_BASE`，MCP 条目只包含启动命令与参数；`install --target all` 同理。
- 旧版本写入的 `env: HDGROW_BASE` 会在 `install`/`update` 时被原地清理；`uninstall` 行为不变。
- README 移除相关环境变量与说明（成长中心能力仅保留在 `develop` 分支）。

## 0.8.0

### Added — GitCode 账号登录（M2）
- 新增 `hdcommunity_auth_login` / `hdcommunity_auth_status` / `hdcommunity_auth_logout`。
- 后端发起 GitCode 授权：本地回环回调（127.0.0.1 随机端口）+ state 校验，换取社区会话 token 并缓存（`~/.config/hdcommunity-toolkit/auth.json`，0600）。
- 无浏览器环境支持手动模式：`wait=false` 返回授权 URL，授权后用 `ticket` 完成登录。
- 用户面请求按 `HDCOMMUNITY_AUTH_MODE`（`auto`/`gitcode`/`aksk`）选择 Bearer 会话或 AK/SK；401 自动清除会话并提示重新登录。
- 后端端点、参数名、超时均可通过环境变量覆盖。

## 0.7.0

### Added — dsh 自动注册
- `install --target dsh` 自动写入 cordis.patch.yml MCP 注册：按 id 幂等、HDGROW_BASE 缺失 fail-fast、uninstall 同步移除托管块（#18，PR #22）。

### Added — README 多 Agent 支持
- SUPPORTED_TARGETS 单一事实源，省略 `--target` 自动检测；README 重写为逐 Agent 安装流程（#23，PR #24）。

### Fixed — 默认域名
- BACKEND_BASE 兜底默认切换为现网 `open-dataset.huaweicloud.com`，`HDCOMMUNITY_BASE` 覆盖保留（#26，PR #27）。

### Fixed — 安装器
- `update --target all` 只刷新已安装 Agent，未安装者不再被创建目录；省略 `--target` 改用已安装检测（#23，PR #24）。

## 0.6.0

### Removed — 上线前收敛为用户面/展示面
- 本项目面向外部生产发布，成长中心仍在开发中，相关能力仅保留在 `develop` 分支。
- 移除全部成长中心工具与配套实现（展示面、用户面、端点常量、涉钱防护、测试）。
- README / 插件清单 / 配置说明不再包含成长中心相关内容。

## 0.5.0

### Added — 错误可观测性
- `UPSTREAM_ERROR` 透出请求 method + path + HTTP 状态（body 截断、不回显敏感头），上游故障可直接定位（#17，PR #19）。

### Fixed — 安装器
- `install/uninstall/status` 携带 `--help` 时只打印帮助，不再误触发真实安装/卸载（#15，PR #20）。
- `uninstall --target opencode` 对称清理 MCP 配置条目；保留用户改写并提示残留路径（#16，PR #21）。

## 0.4.1

### Changed — 用户面包去管理台引用
- README / 插件清单 / 代码注释不再列述管理台能力（不再描述"审核、上下线、置顶、发积分、发券、变更单审批"等），统一表述为"运营/管理能力不属于本包"。
- 确认本包只含：社区用户面、公开只读、成长中心展示面与用户面。

## 0.4.0

### Added — 成长中心用户面
- 用户面工具组 `hdgrow_user_*`（8，AK/SK）：`user_info` / `user_tasks`（含完成状态）/ `user_prizes` / `user_sign_in` / `user_sign_in_status` / `user_points_detail` / `user_exchange_records` / `user_prize_exchange`。
- 身份由网关注入（`X-User-Id`），用户只能访问本人数据；`user_prize_exchange` 复用 `dry_run` 预演 + `confirm_token` + `biz_id` 防护。

### Changed — 运营面迁出（BREAKING）
- **移除成长中心业务侧能力**，与既有管理面一并归入 [hdcommunity-mng-toolkit](https://github.com/huaweicloud-mate/hdcommunity-mng-toolkit)：
  - 工具：`hdgrow_points_query` / `hdgrow_server_tasks` / `hdgrow_server_prizes` / `hdgrow_points_add` / `hdgrow_prize_exchange` / `hdgrow_issue_coupon`；
  - Skill：`hd-grow-operator`；
  - 配套的 `callGrow`、`GROW_BIZ` 端点常量与涉钱防护代码。
- 本仓只保留 **普通用户可看/可用** 的能力：社区博客（写/发/评论/互动）、公开只读、成长中心展示面（`hdgrow_task_list` / `hdgrow_task_categories` / `hdgrow_prize_list`）。
- `HDGROW_BASE` 对展示面改为**测试网关默认值**（可用环境变量覆盖）；业务侧迁至 mng 仓后仍保持必填。

## 0.3.0

### Changed — 管理面迁出（BREAKING）
- **移除管理面能力**，迁至独立仓 [hdcommunity-mng-toolkit](https://github.com/huaweicloud-mate/hdcommunity-mng-toolkit)：
  - 工具：`hdcommunity_admin_*`（博客管理台）、`hdgrow_admin_*`（成长管理台）、`hdcommunity_admin_blog_risk_check`（内容风控）；
  - 统一管理面登录/登出（`admin-session`）；
  - Skill：`hd-blog-operator`、`hd-grow-admin`。
- 本仓现只含 **用户面 + 展示面**：社区博客（写/发/评论/互动）、公开只读、成长中心展示面与业务侧。

## 0.2.0

### Added — 成长中心（HDGrowService）
- 业务侧工具组 `hdgrow_*`（9）：公开只读 3（`hdgrow_task_list` / `hdgrow_task_categories` / `hdgrow_prize_list`）+ 业务 6（`hdgrow_points_query` / `hdgrow_server_tasks` / `hdgrow_server_prizes` / `hdgrow_points_add` / `hdgrow_prize_exchange` / `hdgrow_issue_coupon`）。
- 管理台工具组 `hdgrow_admin_*`（20）：登录/注销；变更单 `change_create|commit|approve|apply|revert|get|page`；任务/权益/白名单查询；记录审计（积分/兑换/发券/定时任务）+ 用户查询；统计。
- Skill：`hd-grow-operator`、`hd-grow-admin`。
- 统一走 `/agent/**`（对齐博客）：展示 `/agent/show/grow/**`（无鉴权）、业务 `/agent/grow/**`（**AK/SK**）、管理台 `/agent/admin/grow/**`（**Bearer**，登录 `/manage/auth/*`）。
- 涉钱写防护：默认 `dry_run` 预演 → 一次性 `confirm_token`（HMAC/TTL 5min/绑定请求体）→ 高风险阈值（面额>100/数量>10）→ 强制 `biz_id` → 禁自动重试。

### Changed
- 版本 `0.1.2 → 0.2.0`；各 agent 插件清单补齐成长中心描述/关键词，`author.url` 统一为 `huaweicloud-mate`。
- `.claude-plugin` capabilities：`["Read"] → ["Read","Write","Interactive"]`。
- **统一管理面登录/登出**：一次 `admin_login`（博客或成长入口）用同一账号同时登录**博客 + 成长**两个管理台；一次 `admin_logout` 同时登出（`src/tools/admin-session.mjs`）。
- 管理台工具组 `hdgrow_admin_*` **默认关闭**（含内部账号登录/审批/生效）；显式开启 `HDGROW_ADMIN_ENABLED=1`。

### Fixed
- `HDGROW_BASE`：**移除默认值**（不再隐式指向测试网关），未配置返回 **`CONFIG_MISSING`**。
- Endpoint 收敛为单一常量源 `src/tools/grow-endpoints.mjs`（消除 `/servlet`、`/server`、`/manage/change-request` 等旧口径）。
- `growStore` 令牌缓存加 TTL（`HDGROW_TOKEN_TTL_MS`）；`confirm_token` 存储加过期清扫 + 上限（`HDGROW_CONFIRM_TOKEN_MAX`）。
- 管理台工具组可关闭：`HDGROW_ADMIN_ENABLED=0`。
- 文档/注释/代码路径与鉴权口径对齐；去除空白噪声、补齐文件尾换行。
- 新增 `CONFIG_MISSING` 错误码（`HDGROW_BASE` 缺失）。
- `buildGrowUrl` 增空 base 兜底（调用方已前置返回 `CONFIG_MISSING`，双层防护）。
