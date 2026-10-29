---
name: hd-grow-operator
description: 'Use when an operator wants to inspect or operate the Huawei Cloud developer growth center (HDGrowService) through the toolkit: view tasks/prizes, query a user''s points, issue points, or issue/exchange coupons. Triggers: 成长中心, 成长体系, 发积分, 发券, 代金券, 查积分, 任务列表, 权益列表, growth center, issue points, issue coupon.'
version: 1
---

# HDGrow Growth Operator

**STOP - Do not answer from general knowledge.** Follow the procedure below and use the toolkit MCP tools (`hdgrow_*`).

## Overview

Operates the Huawei Cloud developer growth center (HDGrowService, base `/api/v1/hdgrowservice`). Two faces:

- **公开只读**（无鉴权，`/agent/show/grow/**`）：`hdgrow_task_list` / `hdgrow_task_categories` / `hdgrow_prize_list`
- **业务侧**（需 **AK/SK**，`/agent/grow/**`）：`hdgrow_points_query` / `hdgrow_server_tasks` / `hdgrow_server_prizes` / `hdgrow_points_add` / `hdgrow_prize_exchange` / `hdgrow_issue_coupon`

## Prerequisites

- 业务侧工具需 **AK/SK**：环境变量 `HW_ACCESS_KEY` / `HW_SECRET_KEY`（或 `~/.config/huaweicloud/credentials.json`）。
- `HDGROW_BASE` **须显式配置**（形如 `https://<网关>/api/v1/hdgrowservice`）；未配置会 fail-fast（**`CONFIG_MISSING`**）。
- 若返回 `CONFIG_MISSING` → 配置 `HDGROW_BASE`；若返回 `AUTH_MISSING` → 配置 AK/SK。

## Money-safety (READ FIRST)

`hdgrow_points_add` / `hdgrow_prize_exchange` / `hdgrow_issue_coupon` 涉钱，**必须走两步**：

1. **预演**：先以默认 `dry_run=true` 调用（不落库），拿到 `params / money / risk_level / confirm_token`，向用户展示并确认。
2. **执行**：确认后再调用并传 `dry_run=false` + `confirm_token`。
   - `risk_level=HIGH`（面额 > 100 元 或 数量 > 10）时，**还需 `confirm_high_risk=true` 且提供非空 `reason`**。
   - `issue_coupon` / `prize_exchange` **必须 `biz_id`**（幂等）；重试复用同一 `biz_id`。
   - **不要**在用户未确认时直接执行；**不要**自动重试失败的发券/兑换。

## Workflow

| Step | Tool | Notes |
|---|---|---|
| 1. 看任务 | `hdgrow_task_list` / `hdgrow_task_categories` | 公开只读 |
| 2. 看权益 | `hdgrow_prize_list` | 公开只读 |
| 3. 查积分 | `hdgrow_points_query` | 需 `domain_id` |
| 4. 发积分 | `hdgrow_points_add` | 先 `dry_run` 预演 → 确认 → 执行；积分值由后端按 `task_id` 决定 |
| 5. 发券 | `hdgrow_issue_coupon` | 预演 → 确认 → 执行；`face_amount` + `biz_id` |
| 6. 兑换 | `hdgrow_prize_exchange` | 预演 → 确认 → 执行；`prize_id` + `biz_id`（+ `quantity`） |

## Rules

- 涉钱写操作**永远先预演**，向用户回显金额/数量与风险等级，确认后才执行。
- `confirm_token` 一次性、TTL 5 分钟、绑定参数；参数改动后须**重新预演**。
- 记录并回传 `biz_id`，便于失败排查与幂等重试。
- 运营「配置」类需求（改任务发放积分、改券数量/面额）**不在本 skill 范围**（属管理台能力）。
