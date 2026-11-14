const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 60000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const probe = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const tables = [...document.querySelectorAll('.qc-rec-sheet table')]
  const bodyTable = tables.find((t) => t.classList.contains('qr-table'))
  const headRows = bodyTable ? [...bodyTable.querySelectorAll('thead tr')].map((tr) => [...tr.children].map((c) => ({ t: txt(c), colspan: c.colSpan, rowspan: c.rowSpan }))) : null
  const firstBody = bodyTable ? [...bodyTable.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => [...tr.children].map((c) => ({ t: (txt(c) || '').slice(0, 20), cls: c.className }))) : null
  return {
    hash: location.hash,
    hasSheet: !!document.querySelector('.qc-rec-sheet'),
    sectionTitle: txt(document.querySelector('.qr-section')),
    headRows,
    bodyRowCount: bodyTable ? bodyTable.querySelectorAll('tbody tr').length : 0,
    firstBody,
    docNo: txt(document.querySelector('.qr-title')),
  }
})
console.log(JSON.stringify(probe, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-02.png' })
