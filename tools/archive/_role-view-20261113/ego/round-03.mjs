// round-03.mjs —— 登录(测试库 + 销售临时账号):工厂下拉用 DOM 定位,避免两个 el-select 撞选择器
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

await page.goto('http://127.0.0.1:8091/#/login', { timeout: 60000 })
await page.waitForTimeout(3000)

// 1) 打开「登录工厂」下拉(两个 el-select:语言 + 工厂,按文本挑)
const opened = await page.evaluate(() => {
  const ws = [...document.querySelectorAll('.el-select__wrapper')]
  const f = ws.find((w) => (w.textContent || '').includes('YINJIA-MES'))
  if (f) f.click()
  return ws.map((w) => (w.textContent || '').replace(/\s+/g, ' ').trim())
})
console.log('下拉候选 = ' + JSON.stringify(opened))
await page.waitForTimeout(800)

// 2) 选「测试库」
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const texts = items.map((i) => (i.textContent || '').replace(/\s+/g, ' ').trim())
  const t = items.find((i) => (i.textContent || '').includes('测试库'))
  if (t) t.click()
  return { texts, clicked: !!t }
})
console.log('工厂下拉项 = ' + JSON.stringify(picked))
await page.waitForTimeout(700)

// 3) 填账号密码并登录
await page.fill('input[placeholder="请输入登录账号"]', 'zz_fv_a')
await page.fill('input[placeholder="请输入登录密码"]', 'Tmp#FieldView2026')
await page.waitForTimeout(200)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
  if (b) b.click()
})
await page.waitForTimeout(6000)

console.log('登录后 hash = ' + (await page.evaluate(() => location.hash)))
console.log('登录后用户 = ' + JSON.stringify(await page.evaluate(() => {
  try { const u = JSON.parse(localStorage.getItem('mes_user') || '{}'); return { username: u.username, realName: u.realName, factory: u.factory, roleName: u.roleName } } catch { return {} }
})))

// 4) 进 QC_RECV 面板
await page.goto('http://127.0.0.1:8091/#/panelx/list/QC_RECV', { timeout: 60000 })
await page.waitForTimeout(7000)

const view = await page.evaluate(() => ({
  hash: location.hash,
  toolbar: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  gridHeaders: [...document.querySelectorAll('.el-table__header th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  rows: document.querySelectorAll('.el-table__body tr').length,
}))
console.log(JSON.stringify(view, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-03-panel-before.png' })
