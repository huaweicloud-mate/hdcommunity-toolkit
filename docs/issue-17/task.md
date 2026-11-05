# Plan / Task — Issue #17

## 方案（关键设计决策）
- 格式化位置：http-client 包装点（B）——method/path/status 在调用点最齐全，errors.mjs 保持纯映射（未改动）。
- message 结构：仅扩展 message，不改 error 结构（code/message 字段不变）。

## 改动点
1. `src/tools/http-client.mjs`
   - `doRequest` / `doGrowRequest` 返回对象附带 `method`、`path`（transportError 分支同样携带）。
   - `unwrap()`：
     - transportError → `UPSTREAM_ERROR: <METHOD> <path> -> 连接失败: <原因>`
     - ApiResponse 业务错误 → `<CODE>: <METHOD> <path> -> HTTP <status> <上游message> | body: <截断>`
     - 非 2xx 无 ApiResponse → `<CODE>: <METHOD> <path> -> HTTP <status> <body截断>`
   - `unwrap` 导出为测试 seam（blog/show/grow 四类调用共用，保证 8 个 hdgrow_user_* 与 blog/show 行为一致）。
   - `bodySnippet()`：body trim 后截断 200 字符，仅取 method/path/status/body，不拼接请求头。
2. `test/http-client-errors.test.mjs`（新增）：unwrap 各分支单测 + 本地 500 服务集成测试 + transport 失败集成测试 + 敏感信息不回显断言。

## 测试 seam
公开接口 `unwrap(resp)`（导出）；集成层走 `callGrowShow`（HDGROW_BASE 可指向本地）。

## 任务拆解
- [x] 红：新增 test/http-client-errors.test.mjs（旧实现下失败）
- [x] 绿：http-client.mjs 最小实现
- [x] 回归：npm test 全过（17/17）
