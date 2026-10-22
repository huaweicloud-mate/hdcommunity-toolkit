# Plan — Issue #3 内容风控方案设计

## 1. 选型调研结论（对应 Spec "成熟的开源/免费方案"要求）

| 候选 | 结论 |
|---|---|
| 云端内容审核 API（华为云 Moderation 等） | ❌ 按量付费，违反硬约束 |
| npm 敏感词库（mint-filter 等 DFA 封装） | ⚠️ 本质是 DFA/Trie 匹配的薄封装，价值在词库数据而非引擎；引入增加供应链面 |
| **本地 DFA 引擎 + 可插拔词库数据** | ✅ 采用。DFA/Trie 是敏感词检测的成熟经典算法（各开源库通用做法）；自实现 ~150 行、零新增运行时依赖；词库与引擎解耦，可通过配置文件接入任意社区开源词库（如 textlink2015/sensitive-stop-words 等 MIT/Apache 词库数据），满足"成熟开源/免费、零付费" |
| 图片风控（nsfwjs 等本地模型） | 二期：需引入 tfjs 模型推理运行时，复杂度超一期范围，@lithinkit 已同意文本先行 |

## 2. 架构

```
hdcommunity_admin_blog_review ─┐
                               ├─(可选 title/content)→ scanBlog() ─→ risk_check 合并进审核响应
hdcommunity_admin_blog_review_batch ─┘                    ↑
hdcommunity_admin_blog_risk_check（独立工具）──────────────┘
                                                    src/tools/risk-control.mjs
                                                    ├─ 词库加载：内置种子 + 用户扩展文件
                                                    └─ DFA/Trie 匹配 + 归一化 + 风险分级
```

## 3. 模块设计

### 3.1 `src/tools/risk-control.mjs`（新增）

**词库结构**（条目：`{ word, category, level }`，level: high/medium/low）：

| category | 语义 | 种子 level |
|---|---|---|
| porn | 色情低俗 | high |
| gambling | 赌博 | high |
| drugs | 毒品/违禁品 | high |
| politics | 政治敏感 | medium |
| abuse | 辱骂攻击 | medium |
| ads | 广告引流 | low |
| custom | 用户自定义默认类 | 用户指定 |

- **内置种子词库**：`BUILTIN_WORDS`（数量精简、可运行，生产建议外挂开源词库）。
- **扩展文件**：`$HDCOMMUNITY_RISK_WORDS_FILE` 或默认 `~/.config/hdcommunity-toolkit/risk-words.json`，
  支持两种条目形态：`"词"`（默认 category=custom/level=medium）或 `{"word":"词","category":"porn","level":"high"}`；
  同词覆盖内置定义。加载失败（缺失/损坏）→ 降级用内置词库并在结果 `wordlist.source` 标注，不抛错（风控探测不得阻断审核）。

**文本归一化**：全角→半角、大写→小写、剔除空白与零宽字符（对抗 `微 信`、`ＧＡＭＢＬＥ`、零宽空格插入等绕过手段）。

**匹配引擎**：Trie 一次构建（模块级缓存，含扩展词）；扫描归一化文本 O(n·L)。

**风险分级**：
- 命中任一 high 词 → `high`
- 命中 medium 词 → `medium`
- 仅 low 词，且命中数 ≥3 → `medium`（广告刷屏升级），否则 `low`
- 无命中 → `none`（pass=true）

**输出报告**（`scanBlog(title, content)`）：
```json
{
  "risk_level": "high|medium|low|none",
  "passed": true,
  "categories": ["porn"],
  "hit_count": 2,
  "hits": [{ "word": "***", "category": "porn", "level": "high", "field": "title|content", "count": 1 }],
  "wordlist": { "source": "builtin+file", "size": 120 },
  "suggestion": "存在高风险违规内容，建议人工重点复核或驳回"
}
```
hits 中输出命中词本体（管理员复核需要知道触发词），不回显正文上下文。

### 3.2 独立工具 `hdcommunity_admin_blog_risk_check`

入参 `{ title?, content? }`（至少一项非空）→ 纯本地风控报告，不调用后端、无需登录态。

### 3.3 审核工具接入（`src/tools/admin-tools.mjs` 修改）

- `hdcommunity_admin_blog_review` 增加可选 `title`/`content`；
  执行顺序：**先本地风控 → 再 POST 审核**；无论风控结果如何都继续审核（仅标记不阻断），
  响应合并 `risk_check` 字段；未提供文本 → `risk_check: { status: "skipped", reason: ... }` 并附使用提示。
- `hdcommunity_admin_blog_review_batch` 增加可选 `items: [{ id, title, content }]`（按 id 匹配），
  输出逐条 `risk_check` + `overall_risk_level` 汇总。
- 风控引擎异常 → 捕获并降级为 `risk_check: { status: "error", message }`，审核照常执行（可用性优先）。

### 3.4 skill / 文档

- `skills/hd-blog-operator/SKILL.md`：工作流步骤 2/3 之间补"风控"说明——分页拿到待审博客后将 title/content 传给 review 自动风控，或单独调用 risk_check；强调结果仅标记、管理员终审。
- `README.md`：35 工具清单 +1（36），补风控说明与词库扩展配置。
- `package.json`：新增 `"test": "node --test tests/"` 脚本（零新增依赖）。

## 4. 测试方案（node:test 内建）

`tests/risk-control.test.mjs`：
1. 干净文本 → none/pass
2. 各 category 命中与等级判定（porn→high、ads×3→medium 等）
3. 标题/正文字段归属（field）
4. 全角/大小写/空白/零宽字符归一化绕过对抗
5. 扩展词库文件加载（临时文件）、同词覆盖、损坏文件降级
6. 独立工具经 `callTool` 调用（无网络）
7. 审核响应合并逻辑（`attachRiskCheck` 纯函数）
8. 现有 smoke（`npm run smoke`）保持通过，tools/list 数量 +1

## 5. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 内置词库覆盖不足 | 词库可插拔扩展（配置文件/开源词库），且仅标记不阻断，管理员终审兜底 |
| 误报 | 输出命中词与类别供管理员判断，不自动驳回 |
| 风控故障影响审核主流程 | try/catch 降级 skipped/error，审核照常执行 |
