// 2026-11-13 生产工单四项需求 · 8091 界面验收 round-01
// 目标：登录 → 打开生产工单页 → 记录工具栏按钮 / 列头 / 控制台错误 + 截图
const task = await taskSpace('wo-create-20261113')
const page = (await task.pages())[0] ?? (await task.newPage())
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
await page.goto('http://127.0.0.1:8091/#/login', { timeout: 30000 })
await page.waitForTimeout(1500)

// 登录（skill 里的固定写法；工厂保持默认 YJ = 本实例主库=测试库）
let logged = false
for (let i = 0; i < 2 && !logged; i++) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin')
    if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(2500)
  logged = !(await page.url()).includes('/login')
  if (!logged) await page.waitForTimeout(1500)
}
console.log('logged=' + logged + ' url=' + (await page.url()))

await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 30000 })
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const info = await page.evaluate(() => ({
  hash: location.hash,
  buttons: [...document.querySelectorAll('.wol-btns button, .wol-btns .el-dropdown')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  headers: [...document.querySelectorAll('.wol-table th')].slice(0, 14).map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim()),
  rowCount: document.querySelectorAll('.wol-table .el-table__body tr').length,
  hasCreateBtn: [...document.querySelectorAll('.wol-btns button')].some((b) => (b.textContent || '').trim() === '新增'),
  hasColSetBtn: [...document.querySelectorAll('.wol-btns button')].some((b) => (b.textContent || '').trim() === '列设置'),
  hasBomBtn: [...document.querySelectorAll('.wol-btns button')].some((b) => (b.textContent || '').trim() === '物料清单'),
  loadMore: (document.querySelector('.wol-loadmore') || {}).textContent || '',
}))
console.log(JSON.stringify(info, null, 1))
console.log('pageerrors=' + JSON.stringify(errors))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r01-list.png' })
console.log('shot=C:/Users/vigna/ego/wo-create-20261113/r01-list.png')
