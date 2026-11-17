const task = await taskSpace('purin-whpick-20261117')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0008', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const before = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const rows = [...document.querySelectorAll('.detail .el-table__body-wrapper tr.el-table__row')].filter(vis)
  const cell = rows[0]?.querySelector('.ref-cell')
  return {
    rowCount: rows.length,
    firstRow: (rows[0]?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    refCellTitle: cell?.getAttribute('title'),
    splitIcon: !!document.querySelector('.detail .split'),
  }
})
console.log('BEFORE=' + JSON.stringify(before, null, 2))

// 点第一行的「仓库」格子(参照格) —— 应该弹多选仓库弹窗
const opened = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const rows = [...document.querySelectorAll('.detail .el-table__body-wrapper tr.el-table__row')].filter(vis)
  const tr = rows[0]
  // 「仓库」列:按表头文字定位列序,再点该行的参照格
  const heads = [...document.querySelectorAll('.detail .el-table__header-wrapper th')].map((th) => (th.textContent || '').trim())
  const idx = heads.findIndex((h) => h === '仓库')
  const cells = [...tr.querySelectorAll('td')]
  const target = cells[idx]?.querySelector('.ref-cell')
  if (!target) return 'no-cell:' + JSON.stringify(heads)
  target.click()
  await sleep(2500)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  return {
    title: dlg ? (dlg.querySelector('.el-dialog__title')?.textContent || '').trim() : null,
    items: dlg ? [...dlg.querySelectorAll('.pwp-item')].length : 0,
    firstItems: dlg ? [...dlg.querySelectorAll('.pwp-item')].slice(0, 5).map((d) => (d.textContent || '').replace(/\s+/g, ' ').trim()) : [],
  }
})
console.log('DIALOG=' + JSON.stringify(opened, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-whpick-20261117/g1-dialog.png' })
