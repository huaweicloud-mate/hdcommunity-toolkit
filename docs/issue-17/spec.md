# Spec — Issue #17 上游错误信息增强

Spec 全文见 Issue #17 评论（issuecomment-6650886876），本目录为其落地副本。

## 目标
- `UPSTREAM_ERROR` 等错误 message 透出 `method + path + HTTP status`（body 截断 ≤200 字符附带）。
- transportError 分支 message 含目标端点（method + path）与连接失败原因。
- 错误码映射不变，仅扩展 message；不回显 AK/SK 等敏感头。

## 验收
- 非 2xx：`UPSTREAM_ERROR: GET /agent/user/grow/info -> HTTP 500 服务器内部错误`
- transportError：`UPSTREAM_ERROR: GET /path -> 连接失败: <原因>`
- 8 个 hdgrow_user_* 与 blog/show 系列行为一致（共用 unwrap）
- 既有测试全过 + 新增 test/http-client-errors.test.mjs 覆盖
