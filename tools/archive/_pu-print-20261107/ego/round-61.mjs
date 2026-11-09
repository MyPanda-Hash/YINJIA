// round-61:材料码弹窗只列「有金额」采购订单打印记录;用过的记录按钮置灰显示「已打码」
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(2500)
const ok = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const j = await r.json().catch(() => null)
  if (j?.data?.token) { localStorage.setItem('mes_token', j.data.token); return true }
  return false
})
console.log('login=' + ok)
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(5500)
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().height > 0)
  const row = rows.find((r) => t(r).includes('YJ-20261105-01'))
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2600)
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const g = [...document.querySelectorAll('.tb-group')].find((el) => t(el).startsWith('打印'))
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(900)
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const it = [...document.querySelectorAll('.ctx-item, .el-dropdown-menu__item')].find((el) => t(el) === '打印材料码')
  it?.click()
})
await page.waitForSelector('.mlq', { state: 'visible', timeout: 15000 })
await page.waitForTimeout(3500)
// 展开采购订单打印记录
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  it?.querySelector('.el-collapse-item__header')?.click()
})
await page.waitForTimeout(1500)
const info = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  const rows = [...(it?.querySelectorAll('.el-table__body tbody tr') || [])].map((tr) => {
    const cells = [...tr.children].map(t)
    const btn = tr.querySelector('button')
    return { cells, btnText: t(btn), disabled: btn ? btn.disabled : null }
  })
  return { rows }
})
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-61-label-used.png' })
