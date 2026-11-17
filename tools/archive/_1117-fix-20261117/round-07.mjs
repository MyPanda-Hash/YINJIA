const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(5000)
await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json()
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user))
  localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
})
await page.reload(); await page.waitForTimeout(9000)
await page.evaluate(() => { location.hash = '#/panelx/list/RD_APPROVAL' })
await page.waitForTimeout(10000)
// 点「新增」进入草稿
const clickedNew = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, .el-button')].find(x => (x.innerText || '').trim() === '新增')
  if (b) { b.click(); return true }
  return false
})
console.log('点新增:', clickedNew)
await page.waitForTimeout(7000)
const before = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.as-info-row')].map(r => (r.innerText || '').replace(/\s+/g, ' ').trim())
  return { infoRows: rows.slice(0, 6), docno: (document.querySelector('.as-docno')?.innerText || '').trim() }
})
console.log('选客户前:', JSON.stringify(before))
// 点「客户名」那一行的参照控件
const clickedRef = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.as-row')]
  const row = rows.find(r => (r.innerText || '').trim().startsWith('一') && (r.innerText || '').includes('客户名'))
  const ctl = row?.querySelector('.as-ref-ctl')
  if (ctl) { ctl.click(); return true }
  return false
})
console.log('点客户名参照:', clickedRef)
await page.waitForTimeout(4000)
// 选第一行
const picked = await page.evaluate(() => {
  const cell = document.querySelector('.el-dialog .el-table__body tbody tr')
  if (cell) { cell.click(); return { clicked: true, text: (cell.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) } }
  const items = [...document.querySelectorAll('.el-dialog .el-table__row')]
  if (items[0]) { items[0].click(); return { clicked: true, text: (items[0].innerText || '').slice(0, 40) } }
  return { clicked: false }
})
console.log('选客户:', JSON.stringify(picked))
await page.waitForTimeout(1500)
// 确认按钮
const confirmed = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')].find(x => /确定|确认/.test(x.innerText || ''))
  if (b) { b.click(); return true }
  return false
})
console.log('点确定:', confirmed)
await page.waitForTimeout(4000)
const after = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.as-info-row')].map(r => (r.innerText || '').replace(/\s+/g, ' ').trim())
  const cust = [...document.querySelectorAll('.as-row')].find(r => (r.innerText || '').includes('客户名'))
  return {
    infoRows: rows.slice(0, 6),
    custRow: cust ? (cust.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50) : null,
  }
})
console.log('选客户后:', JSON.stringify(after, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_1117-fix-20261117/docno-auto2.png' })
await task.finish({ keep: [] })
process.exit(0)
