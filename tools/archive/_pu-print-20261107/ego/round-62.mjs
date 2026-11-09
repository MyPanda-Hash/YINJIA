// round-62:记录两框结构 —— 上框对方版式(可打印成本版式/已打印成置灰),下框本版式(重打/作废)
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
  ;(g?.querySelector('.tb-main') || g?.querySelector('button'))?.click()
})
await page.waitForTimeout(4200)
const info = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => t(d.querySelector('.el-dialog__title')).startsWith('打印采购订单'))
  const boxes = [...dlg.querySelectorAll('.pup-rec-box')].map((b) => ({
    title: t(b.querySelector('.pup-rec-boxtitle')),
    rows: [...b.querySelectorAll('.el-table__body tbody tr')].map((tr) => {
      const cells = [...tr.children].map(t)
      const btn = tr.querySelector('button')
      return { no: cells[0], paired: cells[1], btn: t(btn), disabled: btn ? btn.disabled : null }
    }),
  }))
  return { boxes }
})
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-62-rec-boxes.png' })
