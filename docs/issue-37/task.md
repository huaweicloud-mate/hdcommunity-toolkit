# Task — Issue #37

- [ ] T1 需求/方案文档 `docs/issue-37/{spec,plan,task}.md` → 提交 `docs(#37)`
- [ ] T2（红）新增单测：spawn 失败返回 false、正常启动返回 true、`wait=true` 回环成功路径、
      浏览器未拉起立即返回 `login_url` + 后台换票、超时分支含 `login_url` → 提交 `test(#37)`
- [ ] T3（绿）`openBrowser` 改 `Promise<boolean>`（error / 非零退出 / 宽限窗口）→ 提交 `fix(#37)`
- [ ] T4（绿）`loginWithBrowser` 浏览器未拉起立即失败 + `graceMs` 续存回环服务 + 后台续等回调
- [ ] T5（绿）`fail(details)`、`auth-tools` 透传与后台落盘、`config.LOGIN_URL_GRACE_MS`
- [ ] T6 文档与版本：README 登录兜底说明 + 配置项、CHANGELOG 0.9.2、四个 `plugin.json`/`package.json`/lock
- [ ] T7 全量回归 `npm run test`
- [ ] T8 自审查（5 轴 + 开源前置增量检查）→ push → 建 PR（base=main）
- [ ] T9 Issue 评论告知 + A2A 通知 QA