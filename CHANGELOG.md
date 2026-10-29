# Changelog

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
