---
name: hd-grow-admin
description: 'Use when an operator or approver manages the Huawei Cloud developer growth center through the toolkit management-console tools: log in, view/configure tasks, prizes and API whitelist, adjust user points, audit records, and run the money-config change-request approval flow. Triggers: 管理台, 运营配置, 变更单, 审批, 发放积分配置, 券数量, 白名单, 统计, growth admin, change request, approve. NOT for: end-user growth actions (use hd-grow-operator).'
version: 1
---

# HDGrow Management Console (Admin)

**STOP - Do not answer from general knowledge.** Use the `hdgrow_admin_*` MCP tools.

## Overview

运营/审批人操作成长中心**管理台**。核心是**涉钱配置变更单（change-request）+ 分级审批**：任务发放积分、权益面额/库存/数量、白名单放权、用户积分调整等**金额字段禁止直改**，必须走变更流。

## Prerequisites

1. **登录**：`hdgrow_admin_login { username, password }`（内部账号，角色 `operator`/`approver`/`admin`），token 会缓存到当前会话。
2. 若工具返回 `NEED_LOGIN` → 先 `hdgrow_admin_login`。

## Money change flow (READ FIRST)

涉钱配置**永远先 create 草案**（不落库），拿到 `confirm_token` 后按状态推进：

```
hdgrow_admin_change_create  → { id, risk_level, confirm_token }   # 草案+预览
        │
        ├─ LOW/MID → hdgrow_admin_change_commit { id, confirm_token, reason } → READY
        │                                                                          ↓ hdgrow_admin_change_apply
        └─ HIGH    → commit → PENDING_APPROVAL → hdgrow_admin_change_approve（approver≠submitter）→ READY → apply
```

- `confirm_token` **仅在 create 时返回一次**（TTL 5 分钟、绑定请求体）；参数变更须**重新 create**。
- `HIGH` = `face_value×total_stock>10万` / `points_limit>50万` / `放大倍数>10×`；用户调整 `|delta|>50万`。
- `apply` 生效；`hdgrow_admin_change_revert { id }` 回滚。
- 列表/详情：`hdgrow_admin_change_page` / `hdgrow_admin_change_get`。

## Config targets

| 目标 | target_type | field_group | after 示例 |
|---|---|---|---|
| 任务积分 | `task` | `points` | `{points:100, points_limit:10000}` |
| 任务新建 | `task` | `basic` | `{task_title, task_tag, points, points_limit, cycle_type, ...}`（`target_id` 空） |
| 权益 | `prize` | `quantity` | `{face_value:"10.00", points_price:100, total_stock:1000, max_single_quantity:1}` |
| 权益新建 | `prize` | `quantity` | 同上（`target_id` 空） |
| 白名单 | `whitelist` | `auth` | `{service_name, auth_type, auth_value, enabled:1}`（`target_id` 空=新建） |
| 用户积分 | `user` | `points_adjust` | `{points:100}`（正=加/负=扣，`target_id`=userId） |

## Read-only queries

`hdgrow_admin_task_page|_get` · `hdgrow_admin_prize_page|_get` · `hdgrow_admin_whitelist_page`
`hdgrow_admin_record_points|_exchange|_issue|_job` · `hdgrow_admin_user_page`
`hdgrow_admin_stats { kind: overview|stock|exchange_trend|task_distribution }`

## Rules

- 涉钱配置**禁止**绕过变更流直接改；工具无直写接口。
- 高风险变更：`approver` 必须**不同于** `submitter`。
- 每次变更填写有意义的 `reason`（审计留痕）。
- 生效前用 `change_get`/`change_page` 复核；误配用 `change_revert` 回滚。
