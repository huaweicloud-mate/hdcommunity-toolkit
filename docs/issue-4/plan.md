# Plan: Issue #4 实现方案

## 里程碑
- **M1（P1）**：B1 401 自动重登 + B4 最老待审优先
- **M2（P1）**：B2 条件过滤/dry_run + B3 按 id 回执
- **M3（对齐）**：A 系列字段契约消费 + blog_detail 降级组合

## 模块改动
| 模块 | 改动 |
|---|---|
| src/errors.mjs | 新增 `NEED_LOGIN` 错误码 |
| src/credentials.mjs | `loadAdminCredentials()` / `hasAdminCredentials()`（env 优先，credentials.json 的 admin_user/admin_pass 兜底） |
| src/config.mjs | 新增 `ADMIN_BLOG_DETAIL_PATH`（A3 路径，可 env 覆盖） |
| src/tools/http-client.mjs | callAdmin 统一拦截 401 → autoRelogin（重试一次）→ 仍失败 NEED_LOGIN |
| src/tools/admin-tools.mjs | review_batch 扩展（filter/dry_run/按 id 回执+重试）；待审最老优先排序+待审时长；admin blog page 正文摘要化（A1 降级）；新增 `hdcommunity_admin_blog_detail`（A3 直连，404 降级组合 + 客户端 risk_flags） |
| src/tools/blog-tools.mjs | `hdcommunity_blog_detail` 增加 `include_content`（false 时摘要化） |
| src/tools/index.mjs | 无需改动（自动聚合 definitions） |
| README.md / skills/hd-blog-operator | 工具清单 35→36、工作流指引（dry_run 先行、最老优先、401 自动重登） |
| test/review-enhancements.test.mjs | 新增：401 重登成功/失败、dry_run、按 id 回执、待审排序、正文摘要化、detail 降级 |

## 关键决策
- 401 重试位置：http-client 统一拦截（所有管理面工具一次受益）
- 条件过滤：MCP 层组合（分页查询 → 收集 id → 逐条审核），后端就绪后可切直连
- dry_run 语义：返回 id + 摘要列表（可核对防误审）
- 按 id 回执：逐条调用单审接口（而非后端 batch 总数），天然获得每条明细；失败自动重试一次
- 待审排序：status=1 时客户端按提交/更新时间升序兜底排序，并附 `pending_duration`
- 正文摘要化：admin blog page 返回项去除全文 `content`，替换为 `content_preview`（前 200 字）+ `content_length`
