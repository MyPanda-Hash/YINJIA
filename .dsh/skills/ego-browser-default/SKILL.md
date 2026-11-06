---
name: ego-browser-default
description: Use whenever this project (YINJIA-MES) needs UI verification — 看效果、点击、填表、登录、走流程、截图取证、复现现场报障. All clicking and screenshotting defaults to ego-browser (the user's own Chromium with their logged-in session), not headless tooling and not asking the user to click.
---

# 默认用 ego-browser 做"点"和"看"

用户口径(2026-11-06):

> 「以后测试和点击都默认在 ego 浏览器上操作。写入 skill」

所以:**凡是要打开页面、点按钮、走一遍流程、截图取证的活,第一步就是 `skill('ego-browser')`,
而不是**让用户自己点、也不是用 curl/脚本假装点了 UI(接口探测只用于数据对账,不能替代界面验证)。

## 什么时候必须用

- 用户给了界面截图/报障,要确认"改完长什么样"、"按钮还在不在"、"点下去会怎样";
- 版面/导出/打印预览类改动要看真实渲染(HTML→打印、PDF→浏览器里打开截屏);
- 需要登录态才能看到的页面(自动打印、开单工作台、移动端扫码页等);
- 要在多个地址之间对比(5173 源码版 vs 8090 打包版)。

只读排查(看代码、查库、算哈希)**不需要**开浏览器。

## 标准做法(照抄即可)

```js
const task = await taskSpace('pick-main-material-20261104')   // 本项目固定用这个 task space
const page = task.page('p1')
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 30000 })
await page.waitForTimeout(4000)
// 截图前先恢复窗口,否则偶发 "Cannot capture a screenshot while the window is minimized"
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  rows: [...document.querySelectorAll('.ps-station')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
})), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/xxx.png' })
```

脚本放 `C:/Users/Lenovo/ego/pick-main-material-20261104/round-NN.mjs`,`ego-browser nodejs -e "await import('file:///.../round-NN.mjs')"` 执行;
**脚本和截图最后要拷进 `tools/archive/_<任务>-<日期>/` 一起提交**(证据要能被别人复跑)。

## 本项目必知的地址与入口

| 用途 | 地址 | 说明 |
|---|---|---|
| 源码即时生效 | `http://localhost:5173/#/...` | vite;改完刷新就是新的,验证界面优先用它 |
| 打包版 | `http://127.0.0.1:8090/#/...` | 前端在 jar 里,换 jar/同步 static 才变 |
| 生产服务器 | `http://36.140.66.163:8090` | 现场那套,线上问题复现时才用 |

- 账号 `admin` / `123456`;**登录工厂**下拉必选对:`YJ` = 正式库(HSDZ_MES)、`YJ_TEST` = 测试库(HSDZ_MES_TEST)。
  ⚠ 接口/脚本里传 `HSDZ_MES_TEST` 这种**库名**会静默落回正式库(踩过)。
- 会话会过期:页面跑到登录页时,用下面这段自动登录再继续:

```js
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
```

- 面板路由不是 `#/panelx/list/<CODE>` 就是 `#/sys/<code>`:
  自动打印 = `#/sys/printStation`,开单工作台 = `#/panelx/list/MOBILE_PICK_CREATE`。
  走错路由页面是**空白**(本次踩过),空白先怀疑路由。

## 别做的事

- 别用 `Invoke-WebRequest` 抓页面内文本去"验证界面"(中文 chunk 会被按 Latin-1 解码成乱码,假阴性);
  要验 chunk 里有没有某段中文,下载成文件后 `[System.IO.File]::ReadAllText(path, UTF8)` 再判断。
- 别把浏览器窗口最小化就跑截图;最小化时先 `setWindowBounds { windowState: 'normal' }`。
- 别在没跟用户确认的情况下点"删除/作废/上线"这类不可逆按钮;演示点击只走可回退路径。
