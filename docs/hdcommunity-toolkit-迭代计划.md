# HDCommunityToolkit 接口对齐分析与迭代计划

> 日期：2026-10-19 ｜ 用途：工具包开发的功能全景与分期感知
> 对比对象：绿区（生产完整版）接口清单 vs 本地 `hdblogservice`（简化版）

---

## 一、结论速览

- **绿区**是生产环境的**完整版**博客体系（用户面 + 管理面），本地 `hdblogservice` 是**简化版**。
- 本地简化版覆盖绿区约 **1/3 业务域**（核心「看/写/发/评/审」已具备）。
- 缺口集中在：**标签体系、专栏体系、推荐/榜单、内容安全、举报/驳回、运营装配（Banner/Block/专题/广告/爬虫）、成长记录与事件、平台配置**。
- 建议按「**Agent 友好价值**」分批补齐，而非照搬绿区全部——配置型能力可评估是否值得 Agent 化。

---

## 二、当前已实现（本地简化版）

### 用户面 hdblogservice（`/api/v1/blogservice`）

| 域 | 接口 |
|---|---|
| 博客 | `GET /blog/list`、`GET /blog/detail/{ref}`、`GET /blog/status/{ref}`、`GET /blog/author/info`、`GET /blog/author/his`、`POST /blog/save`、`DELETE /blog/{ref}`、`POST /blog/operate`(点赞/收藏) |
| 评论 | `GET /comment/list`、`POST /comment/add`、`POST /comment/edit`、`DELETE /comment/{commentId}` |
| 草稿 | `GET /draft/list`、`GET /draft/{draftId}`、`POST /draft/save`、`DELETE /draft/{draftId}` |
| 用户 | `GET /user/personal`、`GET /user/stat`、`GET /user/info`、`GET /user/id`、`POST /user/follow` |
| 文件 | `POST /file/upload`、`GET /file/{name}` |

### 管理面 hdblogmngservice（`/api/v1/blogmngservice`）

| 域 | 接口 |
|---|---|
| 认证 | `POST /admin/auth/login`、`POST /admin/auth/logout` |
| 博客审核 | `GET /admin/blog/page`、`POST /admin/blog/review`、`POST /admin/blog/review/batch`、`POST /admin/blog/online`、`POST /admin/blog/top`、`GET /admin/blog/top/list`、`GET /admin/blog/{id}/records` |
| 评论审核 | `GET /admin/comment/page`、`POST /admin/comment/review`、`POST /admin/comment/review/batch`、`POST /admin/comment/online`、`GET /admin/comment/{id}/records` |
| 统计 | `GET /admin/stats` |

---

## 三、绿区能力全景（业务域）

### 用户面（hdblogservice-core，application/domain 分层）

| 业务域 | 绿区能力要点 |
|---|---|
| 博客内容 | 查询/新增/更新/删除、按 ID 批量取内容、内容事件触发 |
| 用户/成员 | `queryMemberInfoById`、`queryMemberByUserId`、`queryPersonalInfo` |
| 评论体系 | 评论、子评论、计数 |
| **标签体系** | `queryCommunityGetTagList`、`queryTagIdsByTagName`、标签计数 |
| **专栏体系** | `queryBlogColumnList`、`queryColumnBlogList`、`queryBlogColumnById` |
| **推荐/榜单** | `queryRecommendBlogVo`、`queryBloggerWeekRankList`、`queryBloggerMonthRankList` |
| 统计 | 统计信息查询 |
| **内容安全** | `ScasService`（对接内容安全能力，审核与结果处理） |
| 发布流程 | `PublishBlogService`（发布编排与校验） |
| 附件 | 附件插入与管理 |

### 管理面（hdblogmngservice）

| 业务域 | 绿区能力要点 |
|---|---|
| 内容审核 | `auditBlog`、`queryBlogAuditList`、`updateAuditBlogComment` 等 |
| 内容管理 | `queryBlogManage`、`updateBlogManage`、`queryBlogContent` 等 |
| 统计 | `queryStatistics`、`queryTopBlogNum`、`queryMemberStatistics` |
| 置顶管理 | `updateContentByTopOpration`、`updateIncrPositionContent`、`updateDecrPositionContent` 等（位置递增/递减/计算） |
| **举报管理** | `queryBlogReportList`、`updateBlogReportStatus`、`queryBlogReportCount` |
| **驳回记录** | `queryAuditRejectedList`、`queryAuditRejectedListCount` |
| **标签管理** | `incrTagNum`、`reduceTagNum`、`incrVideoTagNum` 等 |
| **Banner 配置** | `insertBannerInfo`、`queryBannerList`、`updateBannerInfo`、`deleteBannerById` |
| **Block 配置** | `insertBlockDetailInfo`、`insertRightBlockInfo`、`insertSubjectInfo`、`queryBlockDetailList`、`queryRightBlockList` |
| **专题管理** | `insertSpecialInfo`、`insertSpecialArticleInfo`、`insertSpecialCategoryInfo`、`insertSpecialSubjectList`、`offlineSpecial`、`recommendSpecialById` |
| **广告配置** | `queryBlogAdvert`、`updateBlogAdvertisement` |
| **爬虫配置** | `insertSpiderConfig`、`querySpiderConfig`、`updateSpiderConfig`、`updateSpiderConfigLaunch` |
| **文章排序** | `updateArticleOrder`、`deleteArticleOrder` |
| **成长记录** | `addGrowthRecord` |
| **事件触发** | `updateTcommunityContentScoreEvent`、`updateTcommunityStatisticsEvent` |
| **服务配置** | `insertBlogService`、`updateBlogService`、`queryBlogServiceList`、`insertAsyncTask` |
| 用户信息 | `queryMemberInfoById`、`queryMemberVo`、`queryGetMemberInfo` |
| 附件管理 | `insertAttachment`、`insertAttachmentOperation`、`queryBlogAttachments` |

---

## 四、差异矩阵（已实现 / 待实现）

| 面 | 业务域 | 简化版状态 |
|---|---|---|
| 用户面 | 博客内容、评论、草稿、用户、图片 | ✅ 已实现 |
| 用户面 | 统计 | ✅ 基本 |
| 用户面 | 附件 | ⚠️ 仅图片上传 |
| 用户面 | **标签体系** | ❌ 待实现 |
| 用户面 | **专栏体系** | ❌ 待实现 |
| 用户面 | **推荐/榜单** | ❌ 待实现（前端空壳） |
| 用户面 | **内容安全（Scas）** | ❌ 待实现（现为人工审核） |
| 管理面 | 内容审核、置顶(基础)、统计 | ✅ 已实现 |
| 管理面 | 内容管理 | ⚠️ 仅分页查询 |
| 管理面 | 用户信息 | ⚠️ 部分 |
| 管理面 | 置顶高级（位置递增/递减） | ⚠️ 仅基础置顶 |
| 管理面 | **举报管理** | ❌ 待实现 |
| 管理面 | **驳回记录** | ❌ 待实现（有 `review_remark`，无独立查询） |
| 管理面 | **标签管理** | ❌ 待实现 |
| 管理面 | **Banner / Block / 专题 / 广告 / 爬虫** | ❌ 待实现 |
| 管理面 | **文章排序** | ❌ 待实现 |
| 管理面 | **成长记录 / 事件触发** | ❌ 待实现 |
| 管理面 | **服务配置 / AsyncTask** | ❌ 待实现 |

---

## 五、迭代计划

> 原则：先「用户/运营高频 + Agent 友好」的核心能力，后「配置型 / 图形化更合适」的能力。

| 迭代 | 主题 | 覆盖业务域 | 对应工具包阶段 | 说明 |
|---|---|---|---|---|
| **I1** | 工具包底座 + 用户面核心 | 博客、评论、草稿、用户、图片 | P0 | 增量现状包装成 MCP（AK/SK 认证） |
| **I2** | 管理面审核 | 内容审核、上下线、置顶、统计 | P1 | 内部登录 + 审核 MCP |
| **I3** | 内容组织 | **标签体系、专栏体系** | 新增 | 用户面可见的核心组织能力（当前完全缺失） |
| **I4** | 内容发现 | **推荐、周/月榜单、统计增强** | 新增 | 用户面体验；榜单现为空壳 |
| **I5** | 成长与事件 | **成长记录、内容积分/统计事件** | P2-P3 | 与成长中心（hdgrowthservice）打通 |
| **I6** | 治理与安全 | **内容安全(Scas)、举报管理、驳回记录、文章排序** | 新增 | 内容治理；Scas 替代人工审核 |
| **I7** | 运营装配 | **Banner、Block、专题、广告、爬虫配置** | 评估 | 配置型；先评估 Agent 化必要性 |
| **I8** | 平台配置 | **服务配置、AsyncTask** | 评估 | 后台配置型 |

### 每迭代交付物（统一）

每个迭代产出三件套：① 业务后端 Agent 聚合接口 `/agent/<域>/*`（复用 §3 认证）；② 工具包 MCP 工具组 `hdcommunity_<域>_*`；③ 对应 skill。

---

## 六、关键建议

1. **不必全搬绿区**。按「Agent 友好价值」取舍：
   - **高价值（优先）**：博客、评论、标签、专栏、审核、榜单、成长——高频、适合对话操作。
   - **低价值（评估）**：Banner / Block / 专题 / 广告 / 爬虫 / 服务配置——配置型，图形化后台更合适，Agent 化收益待评估。
2. **成长记录 + 事件触发**（`addGrowthRecord`、`TcommunityContentScoreEvent`）与「成长中心」强耦合，应排在运营装配之前（I5）。
3. **标签/专栏当前完全缺失**，若用户面要完整，I3 不可省。
4. **内容安全（Scas）** 是审核自动化的关键，当前简化版靠人工审核，I6 补齐后可大幅降低运营负担。
5. **覆盖度感知**：绿区约 28 个业务域，简化版已覆盖约 9 个（~1/3）；按上表 8 个迭代可逐步对齐，其中 I1–I2 已在设计阶段覆盖。

---

## 附：能力域计数

| 维度 | 数量 |
|---|---|
| 绿区业务域（用户面 + 管理面） | 约 28 |
| 简化版已覆盖 | 约 9 |
| 待补齐（I3–I8） | 约 19 |
| 迭代批次 | 8（I1–I8） |
