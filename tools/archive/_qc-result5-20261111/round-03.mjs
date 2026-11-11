const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0036', { timeout: 60000 })
await page.waitForTimeout(7000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const probe = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const bodyTable = document.querySelector('.qc-rec-sheet table.qr-table')
  const rows = bodyTable ? [...bodyTable.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.children].map((c) => ({ cls: c.className, t: (txt(c) || '').slice(0, 24), inputs: c.querySelectorAll('input,textarea').length }))) : null
  const status = txt(document.querySelector('.approval-side .st, .approval-side'))
  return {
    rows,
    editableInputs: document.querySelectorAll('.qc-rec-sheet table.qr-table tbody input').length,
    status: (status || '').slice(0, 80),
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
  }
})
console.log(JSON.stringify(probe, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-03.png' })
