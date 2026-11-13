// round-18.mjs —— 8090(打包版)只读确认:登录页选正式库 → admin → 表格调整弹窗的作用域条
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip') }

await page.goto('http://127.0.0.1:8090/#/login', { timeout: 60000 })
await page.waitForTimeout(3000)

await page.evaluate(() => {
  const ws = [...document.querySelectorAll('.el-select__wrapper')]
  const f = ws.find((w) => (w.textContent || '').includes('YINJIA-MES'))
  if (f && !(f.textContent || '').includes('测试库')) f.click()
})
await page.waitForTimeout(700)
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const t = items.find((i) => (i.textContent || '').includes('测试库'))
  if (t) t.click()
  return items.map((i) => (i.textContent || '').replace(/\s+/g, ' ').trim())
})
console.log('工厂项 = ' + JSON.stringify(picked))
await page.waitForTimeout(600)

await page.fill('input[placeholder="请输入登录账号"]', 'admin')
await page.fill('input[placeholder="请输入登录密码"]', '123456')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
  if (b) b.click()
})
await page.waitForTimeout(6000)
console.log('hash = ' + (await page.evaluate(() => location.hash)))
console.log('用户 = ' + JSON.stringify(await page.evaluate(() => {
  try { const u = JSON.parse(localStorage.getItem('mes_user') || '{}'); return { username: u.username, factory: u.factory } } catch { return {} }
})))

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_RECV', { timeout: 60000 })
await page.waitForTimeout(7000)
await page.evaluate(() => {
  const more = [...document.querySelectorAll('.tb-main .act-name')].find((s) => (s.textContent || '').trim() === '更多')
  more?.closest('.tb-group')?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').trim() === '表格调整')
  if (it) it.click()
})
await page.waitForTimeout(1600)

const dlg = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  if (!box) return null
  return {
    scopes: [...box.querySelectorAll('.col-pref-scope .el-radio-button')].map((e) => ({ t: (e.textContent || '').replace(/\s+/g, ' ').trim(), on: e.className.includes('is-active') })),
    tip: (box.querySelector('.col-pref-tip')?.textContent || '').replace(/\s+/g, ' ').trim(),
    rows: box.querySelectorAll('.col-pref-row').length,
    footer: [...box.querySelectorAll('.el-dialog__footer button')].map((b) => (b.textContent || '').trim()),
  }
})
console.log('8090 弹窗 = ' + JSON.stringify(dlg, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-18-8090-dialog.png' })

// 只读:不保存,直接关掉
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  box?.querySelector('.el-dialog__headerbtn')?.click()
})
