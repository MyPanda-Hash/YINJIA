const task = await taskSpace('finish-in-failqty')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/FINISH_IN?docNo=FI-2026-11-0010', { timeout: 30000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const rows = [...document.querySelectorAll('.el-table__body tr')]
  const firstRowInputs = rows[0] ? [...rows[0].querySelectorAll('input')].map((i) => ({ ph: i.placeholder, value: i.value })) : []
  return {
    hash: location.hash,
    docTitle: (document.querySelector('.doc-title, .panel-title, .rs-title')?.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
    heads,
    rowCount: rows.length,
    firstRowText: rows[0] ? (rows[0].innerText || '').replace(/\s+/g, ' ').slice(0, 300) : '',
    firstRowInputs,
    bodySnippet: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
  }
}), null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/finish-in-gate-qty/ego/round-03-panel.png' })
console.log('shot ok')
