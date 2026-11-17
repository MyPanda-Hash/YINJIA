// round-01:生产 8090 部署后界面验收 —— 登录 + 侧栏「样品检验」一级模块
const task = await taskSpace('deploy-20261116-verify')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090/', { timeout: 60000 })
await page.waitForTimeout(5000)

// 自动登录(账号/密码 admin/123456;登录工厂默认 YJ=正式库)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const user = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pass = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (user) setVal(user, 'admin')
  if (pass) setVal(pass, '123456')
})
await page.waitForTimeout(600)
// 记录登录工厂下拉当前值(应含 YJ / 正式)
const factory = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('.el-select__placeholder, .el-select__selected-item, input')]
  return inputs.map((n) => (n.textContent || n.value || '').trim()).filter((t) => t.includes('YJ') || t.includes('测试'))
})
console.log('登录工厂可见值:', JSON.stringify(factory))

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(7000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
} catch (e) { console.log('restore skip: ' + e.message) }

const state = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)]
  const topItems = q('.sidebar .menu-title, .sidebar > div > .el-sub-menu__title, .nav .menu-title')
    .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  const anyText = (document.body.innerText || '')
  return {
    hash: location.hash,
    loggedIn: !anyText.includes('进入系统'),
    hasQC: anyText.includes('品质管理'),
    hasSampleModule: anyText.includes('样品检验'),
    sidebarTop: topItems.slice(0, 30),
    chunk: [...document.scripts].map((s) => s.src).filter(Boolean).slice(0, 3),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/deploy-20261116/round-01-after-login.png' })
