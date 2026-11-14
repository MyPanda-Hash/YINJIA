const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0007', { timeout: 60000 })
await page.waitForTimeout(10000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) {}
const head = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    side: (txt(document.querySelector('.approval-side')) || '').slice(0, 22),
    footLabels: [...document.querySelectorAll('.qr-foot-table th')].map((e) => (txt(e) || '')),
    reqMarks: [...document.querySelectorAll('.qr-req')].length,
  }
})
console.log(JSON.stringify(head, null, 2))
const opened = await page.evaluate(() => {
  const td = document.querySelectorAll('.qr-foot-table tr')[0]?.querySelector('td:last-child')
  const s = td && td.querySelector('.el-select__wrapper')
  if (!s) return 'NO-SELECT'
  s.click()
  return 'OPENED'
})
console.log(opened)
await page.waitForTimeout(1500)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
  .filter((o) => o.offsetParent !== null).map((o) => (o.textContent || '').trim()))
console.log('verdictOptions=' + JSON.stringify(opts))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-70-verdict.png' })
