const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0001', { timeout: 60000 })
await page.waitForTimeout(8000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const probe = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const bodyTable = document.querySelector('.qc-rec-sheet table.qr-table')
  return {
    hash: location.hash,
    addBar: txt(document.querySelector('.qr-addbar')),
    rowCount: bodyTable ? bodyTable.querySelectorAll('tbody tr').length : 0,
    inputs: document.querySelectorAll('.qc-rec-sheet table.qr-table tbody input').length,
    side: (txt(document.querySelector('.approval-side')) || '').slice(0, 120),
    headNo: [...document.querySelectorAll('.qr-head-table .qr-value')].map((c) => (txt(c) || '').slice(0, 16)),
  }
})
console.log(JSON.stringify(probe, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-05.png' })
