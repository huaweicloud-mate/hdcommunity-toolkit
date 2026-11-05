# Spec — Issue #26 默认后端域名切换为现网 open-dataset

> 来源：Issue #26 正文 + VOD 收敛结论 + issue agent Spec（评级 ready，目标分支 main） | 优先级 P1 | 目标分支 main

## 1. 背景与目标

`v0.6.0` 的默认后端地址仍是测试环境 `opentest-dataset.huaweicloud.com`。未显式配置
`HDCOMMUNITY_BASE` 的新用户，所有请求（社区用户面、展示面、文件上传）都会打到测试环境，
造成"装完即用"体验直接错配。

目标：默认打到现网 `open-dataset.huaweicloud.com`，同时保留 `HDCOMMUNITY_BASE` 覆盖能力，
测试环境用户显式设置后仍可指向 `opentest-dataset`。

## 2. 期望行为

1. 未设置 `HDCOMMUNITY_BASE` → `BACKEND_BASE = https://open-dataset.huaweicloud.com/api/v1/blogservice`
   （context-path `/api/v1/blogservice` 不变）。
2. 显式设置 `HDCOMMUNITY_BASE=https://opentest-dataset.huaweicloud.com/api/v1/blogservice`
   → `BACKEND_BASE` 取该值（覆盖语义不变，零新增开关）。
3. 文档（README 配置表、`skills/hd-blog-author/SKILL.md` 两处示例）不再出现 `opentest-dataset`
   作为默认域名；示例改用 `<backend-base>` 占位符，避免默认值再变更时文档漂移。

## 3. 范围

### In Scope
- `src/config.mjs`：`BACKEND_BASE` 兜底常量改为现网地址
- `README.md`：配置表 `HDCOMMUNITY_BASE` 默认值同步为现网地址
- `skills/hd-blog-author/SKILL.md`：图片/正文示例域名改为 `<backend-base>` 占位符并说明取值来源
- `test/`：新增配置默认值/覆盖行为测试 + 文档一致性回归测试

### Out of Scope
- 不改动任何接口路径、请求参数、鉴权逻辑
- 不新增环境变量，不改变 `HDCOMMUNITY_BASE` 覆盖语义
- 不改 `docs/` 下历史实现规格文档（属历史存档，非用户面文档）
- 版本号 / CHANGELOG（由后续 release 统一处理）

## 4. 验收标准
- [ ] 不设置 `HDCOMMUNITY_BASE` 时，`BACKEND_BASE` 为 `https://open-dataset.huaweicloud.com/api/v1/blogservice`
- [ ] 显式设置 `HDCOMMUNITY_BASE=https://opentest-dataset.huaweicloud.com/api/v1/blogservice` 时仍可指向测试环境
- [ ] `README.md` 与 `skills/hd-blog-author/SKILL.md` 无 `opentest-dataset` 默认表述残留
- [ ] 现有测试全部通过，新增/调整测试覆盖默认值与覆盖行为

## 5. 关键约束
- `process.env.HDCOMMUNITY_BASE || '<default>'` 结构保持不变（空串/未设置均走默认值）
- 文档用占位符而非写死域名，防止与默认值二次漂移
- 零新增运行时依赖

## 6. 风险与缓解
| Risk | Impact | Mitigation |
|---|---|---|
| 测试环境用户未显式配置而受影响 | Med | README 配置表保留现网默认值说明；SKILL.md 说明测试环境需显式设置 `HDCOMMUNITY_BASE` |
| 文档示例与实际默认值再次漂移 | Low | 示例统一 `<backend-base>` 占位符 + 文档一致性回归测试 |