const task = await taskSpace('purinsplit-20261117')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0002', { timeout: 60000 })
await page.waitForTimeout(8000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const before = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const rows = [...document.querySelectorAll('.detail .el-table__body-wrapper tr.el-table__row')].filter(vis)
  return {
    hash: location.hash,
    addBtn: !!document.querySelector('.add-data-btn'),
    rows: rows.map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
    splitIcons: [...document.querySelectorAll('.detail .split')].filter(vis).length,
  }
})
console.log('BEFORE=' + JSON.stringify(before, null, 2))

// 点第一行的「拆分」图标
const opened = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const icons = [...document.querySelectorAll('.detail .split')].filter(vis)
  if (!icons.length) return 'no-icon'
  icons[0].click()
  await sleep(2500)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  if (!dlg) return 'no-dialog'
  const rows = [...dlg.querySelectorAll('.el-table__body-wrapper tr.el-table__row')]
  return {
    title: (dlg.querySelector('.el-dialog__title')?.textContent || '').trim(),
    rowCount: rows.length,
    rows: rows.map((tr) => [...tr.querySelectorAll('input')].map((i) => i.value)),
  }
})
console.log('DIALOG=' + JSON.stringify(opened, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purinsplit-20261117/s4-dialog.png' })
