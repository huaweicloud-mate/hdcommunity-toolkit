# Plan — Issue #37

## 方案

改动集中在登录模块与登录工具的返回结构，回环服务与换票逻辑不变。

### 1. `openBrowser(url, opts?)`（src/auth/gitcode-login.mjs）

由「spawn 后立即 `return true`」改为 `Promise<boolean>`：

```js
const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
child.once('error', () => finish(false));        // ENOENT/EACCES 等 spawn 失败
child.once('exit', (code) => finish(code === 0)); // powershell/open/xdg-open 非 0 退出即失败
timer = setTimeout(() => finish(true), graceMs);  // 常驻 opener 超过宽限窗口视为已拉起
```

- `finish(true)` 时才 `child.unref()`，保证未判定前仍能收到事件；
- 保留 Windows 的 `powershell Start-Process`（避免 `cmd /c start` 吞 URL 中的 `&`）；
- 可选 `opts`（`platform` / `cmd` / `args` / `graceMs`）仅用于单测注入，生产调用不传。

### 2. `loginWithBrowser(opts)`（src/auth/gitcode-login.mjs）

```text
startCallbackServer(state, timeoutMs + graceMs)   // 服务多活 grace 窗口
  ├─ 浏览器拉起失败 → 立即 fail(AUTH_FAILED, 含 login_url, {browser_opened:false, login_url})
  │                     + 后台续等票据（onBrowserUnopened）
  └─ 等待窗口内拿到票据 → exchangeTicket → ok({..., browser_opened, login_url})
      等待窗口超时 → fail(AUTH_FAILED, 含 login_url, {browser_opened, login_url})
                     + 后台续等票据（grace 窗口内手动授权仍落盘）
```

- `timeoutMs` 仍是「工具调用愿意等多久」，`graceMs` 是「URL 还能用多久」，二者分离；
- 后台续等由 `onBrowserUnopened({ state, redirectUri, loginUrl, result })` 注入，
  `auth-tools` 实现为「票据 → exchangeTicket → saveSession」，避免登录模块反向依赖 token-store；
- `state` 校验、`ticket` 解析、换票请求体均不变。

### 3. `hdcommunity_auth_login`（src/tools/auth-tools.mjs）

- 失败结果直接返回 `loginWithBrowser` 的 `fail`，`browser_opened` / `login_url` 落在
  `error` 上（仅新增字段，旧字段不动）；成功后仍返回 `browser_opened` / `login_url`。
- 注入后台续等回调，用户手动授权后 `auth.json` 自动生成，`hdcommunity_auth_status` 可见登录态。

### 4. `fail(code, message, details?)`（src/errors.mjs）

可选第三个参数合并到 `error` 对象，供登录失败结果携带结构化兜底信息；不传时行为完全不变。

### 5. 测试 seam

复用既有公开 seam，不测内部细节：

| 用例 | seam |
|------|------|
| spawn 失败返回 false | `openBrowser(url, { cmd: '<不存在的启动器>' })`（真实 `ENOENT`） |
| 正常启动返回 true | `openBrowser(url, { cmd: process.execPath, args: ['-e', '0'] })`（真实 0 退出） |
| wait=true 成功路径 | `loginWithBrowser({ launcher })` 用假启动器解析 `login_url` 的 `redirect_uri`+`state` 并打回调 |
| 浏览器未拉起 | `loginWithBrowser({ launcher: async () => false, onBrowserUnopened })`：立即返回 + 后台票据/换票；同时校验 `callTool` 在 `wait=true`+`timeout_s` 超时下返回 `login_url` |

## TDD 顺序

1. 红：先提交 `test(#37)`（spawn 失败、成功路径、未拉起、超时四组），确认当前实现下失败；
2. 绿：改 `openBrowser` / `loginWithBrowser` / `auth-tools` / `errors` / `config`，测试转绿；
3. 回归：`npm run test` 全绿。

## 风险

| 风险 | 缓解 |
|------|------|
| 把「成功 spawn 但浏览器实际没开」误判为已拉起 | 仍走超时分支并附 `login_url`；用户可手动打开，URL 在 grace 窗口内有效 |
| 后台续等导致进程/测试挂住 | 服务总存活时间固定为 `timeoutMs + graceMs`，到时自动 close；测试注入短 `graceMs` |
| 返回结构变化影响下游解析 | `fail` 仅新增字段；成功路径结构不变 |
| 误判非零退出为失败（如 opener 正常但返回 1） | 宽限窗口内只要未退出即视为已拉起，仅明确非 0 退出才判失败 |