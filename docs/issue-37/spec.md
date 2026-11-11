# Spec — Issue #37：浏览器启动失败/超时时返回 `login_url` 兜底

## 背景

MCP（stdio）场景下调用 `hdcommunity_auth_login`（默认 `wait=true`），Windows 上
`openBrowser()` 以 `spawn('powershell', ['-Command', "Start-Process '<url>'"])` +
`stdio: 'ignore'` + `detached: true` 启动后**立即 `return true`**，不监听子进程 `error` 事件，
`Start-Process` 失败时错误被完全吞掉：

- 浏览器从未弹出，回环回调收不到 `ticket`，只能等满 `LOGIN_TIMEOUT_MS`（默认 120s）；
- MCP 客户端自身请求超时更短（opencode 实测 `Request timed out`），用户看到的是转圈，
  既没有错误、也拿不到授权 URL，`auth.json` 始终不生成。

## 目标

登录链路在浏览器拉不起来时**不再静默超时**：立即返回 `browser_opened: false` 与一个
**当前仍可用**的 `login_url`，用户手动打开完成 GitCode 授权后，同一回环服务收到票据并换票
落盘（生成 `auth.json`），无需改后端、无需预配置 `HDCOMMUNITY_GITCODE_REDIRECT_URI`。

## 范围

In scope：

- `src/auth/gitcode-login.mjs`
  - `openBrowser()` 改为 `Promise<boolean>`：监听子进程 `error`（spawn 失败，如 `ENOENT`）
    与非零退出码 → `false`；宽限窗口内仍存活（opener 常驻）→ `true`。
  - `loginWithBrowser()` 浏览器未拉起时**立即失败返回**（不空等 120s），错误含
    `browser_opened: false` + `login_url`；超时分支同样附 `login_url`。
  - 回环服务在工具等待窗口后再存活 `LOGIN_URL_GRACE_MS`（默认 300s），保证返回的
    `login_url` 在用户粘贴/打开期间仍然有效。
- `src/tools/auth-tools.mjs`：透传 `browser_opened` / `login_url`（失败结果仅新增字段，
  向后兼容）；后台续等票据 → `exchangeTicket` → `saveSession`，用户手动授权后会话自动落盘。
- `src/errors.mjs`：`fail(code, message, details?)` 可选附加结构化字段（仅新增）。
- `src/config.mjs`：新增 `LOGIN_URL_GRACE_MS`（`HDCOMMUNITY_LOGIN_URL_GRACE_MS`，默认 300000）。
- `test/auth.test.mjs`：新增 spawn 失败、成功路径、浏览器未拉起、超时四组用例。
- README / CHANGELOG / 版本号（0.9.2）。

Out of scope：

- 后端 OAuth / 换票接口改动（票据仍由同一回环服务接收）；
- `remote: true` 远程登录既有行为；
- `wait: false` 手动模式默认行为与 `HDCOMMUNITY_GITCODE_REDIRECT_URI` 依赖。

## 验收标准

- [ ] 浏览器无法拉起时，`hdcommunity_auth_login` 返回 `browser_opened: false`，错误信息含
      可直接打开的 `login_url`，不再出现无提示的 120s 超时。
- [ ] 用户用该 `login_url` 在本机浏览器完成授权后，同一回环服务收到 `ticket` 并换取会话
      （生成 `auth.json`）。
- [ ] `openBrowser()` 的 spawn 失败用例有单测覆盖（监听 `error`，返回 `false`）。
- [ ] `wait=true` 成功路径与 `remote:true` / `wait=false` 行为不回归（现有测试全绿）。