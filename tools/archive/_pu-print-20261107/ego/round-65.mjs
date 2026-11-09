// round-65:10 行订单明细全列(无内滚动) + 弹窗无外层滚动条 + 两块可收缩
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }
try { await page.keyboard.press('Escape') } catch (e) { /* ignore */ }
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
const picked = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().height > 0)
  const row = rows.find((r) => t(r).includes('YJ-20261103-01'))
  if (row) { row.scrollIntoView({ block: 'center' }); row.click(); return 'ok' }
  return 'none'
})
console.log('pick=' + picked)
await page.waitForTimeout(2600)
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const g = [...document.querySelectorAll('.tb-group')].find((el) => t(el).startsWith('打印'))
  ;(g?.querySelector('.tb-main') || g?.querySelector('button'))?.click()
})
await page.waitForTimeout(4500)
const info = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => t(d.querySelector('.el-dialog__title')).startsWith('打印采购订单'))
  if (!dlg) return { open: false }
  const main = dlg.querySelector('.pup > .el-table')
  const wrap = main?.querySelector('.el-table__body-wrapper .el-scrollbar__wrap') || main?.querySelector('.el-table__body-wrapper')
  const pup = dlg.querySelector('.pup')
  return {
    open: true,
    title: t(dlg.querySelector('.el-dialog__title')),
    mainRows: main?.querySelectorAll('.el-table__body tbody tr').length,
    table: wrap ? { clientH: wrap.clientHeight, scrollH: wrap.scrollHeight } : null,
    pupScroll: pup ? { clientH: pup.clientHeight, scrollH: pup.scrollHeight } : null,
    items: [...dlg.querySelectorAll('.pup-rec-collapse .el-collapse-item')].map((it) => ({
      title: t(it.querySelector('.pup-rec-boxtitle')), active: it.classList.contains('is-active'),
    })),
  }
})
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-65-full-list.png' })
