const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) {}
const st = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const ths = [...document.querySelectorAll('.qr-sheet thead th, .record-sheet thead th, .rs th')].map((e) => (txt(e) || '').slice(0, 14))
  return { hash: location.hash, body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120), headers: ths.slice(0, 14) }
})
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-77-req-series.png' })
