const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) {}
console.log('open=' + await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qc-bar-btn')].find((x) => /自定义字段/.test(x.textContent || ''))
  if (!el) return 'NO-BTN'
  el.click(); return 'OK'
}))
await page.waitForTimeout(2800)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return null
  return { title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(), labels: [...d.querySelectorAll('.el-form-item__label')].map((e) => (e.textContent || '').trim()) }
})
console.log(JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-83-dialog-3fields.png' })
