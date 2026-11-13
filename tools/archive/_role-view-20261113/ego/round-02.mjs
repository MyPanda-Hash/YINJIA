// round-02.mjs —— 用测试库 + 销售角色临时账号登录,打开 QC_RECV(送料暂收单),看工具栏
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

// 截图前恢复窗口(最小化时截图会报错)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

await page.goto('http://127.0.0.1:8091/#/login', { timeout: 60000 })
await page.waitForTimeout(3000)

// 1) 登录工厂选「测试库」(默认是正式库)
await page.click('.el-select__wrapper')
await page.waitForTimeout(700)
const factory = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const texts = items.map((i) => (i.textContent || '').replace(/\s+/g, ' ').trim())
  const t = items.find((i) => (i.textContent || '').includes('测试库'))
  if (t) t.click()
  return { texts, clicked: !!t }
})
console.log('工厂下拉 = ' + JSON.stringify(factory))
await page.waitForTimeout(600)

// 2) 填账号密码
await page.fill('input[placeholder="请输入登录账号"]', 'zz_fv_a')
await page.fill('input[placeholder="请输入登录密码"]', 'Tmp#FieldView2026')
await page.waitForTimeout(200)
await page.click('button')
await page.waitForTimeout(5000)

console.log('登录后 hash = ' + (await page.evaluate(() => location.hash)))
console.log('登录后用户 = ' + JSON.stringify(await page.evaluate(() => {
  const raw = localStorage.getItem('mes_user') || '{}'
  try { const u = JSON.parse(raw); return { username: u.username, realName: u.realName, factory: u.factory, roleName: u.roleName } } catch { return { raw: raw.slice(0, 200) } }
})))

// 3) 进面板
await page.goto('http://127.0.0.1:8091/#/panelx/list/QC_RECV', { timeout: 60000 })
await page.waitForTimeout(6000)

const view = await page.evaluate(() => ({
  hash: location.hash,
  title: (document.querySelector('.panel-title, .doc-title, h2, h3')?.textContent || '').trim(),
  toolbar: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  gridHeaders: [...document.querySelectorAll('.el-table__header th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  rows: document.querySelectorAll('.el-table__body tr').length,
}))
console.log(JSON.stringify(view, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-02-panel.png' })
