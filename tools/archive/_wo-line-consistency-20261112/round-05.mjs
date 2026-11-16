// 2026-11-12 round-05:生产工序进度看板(正确路由 workOrderProgress)冒烟 —— 它也用 linesSummary 的产线下拉
const task = await taskSpace('wo-line-consistency-20261112')
const page = task.page('p1')
const errors = []
page.on?.('console', (m) => { if (m && m.type && m.type() === 'error') errors.push(m.text()) })
page.on?.('pageerror', (e) => errors.push('pageerror: ' + (e && e.message)))

await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 40000 })
await page.waitForTimeout(6500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { /* ignore */ }
const info = await page.evaluate(() => ({
  hash: location.hash,
  page: !!document.querySelector('.wpb-page'),
  alert: !!document.querySelector('.el-alert--error'),
  lineOptions: [...document.querySelectorAll('.wpb-sel')].length,
  lineText: [...document.querySelectorAll('.wpb-sel .el-select__placeholder, .wpb-sel .el-select__selected-item')].map((x) => (x.textContent || '').trim()),
  rowCount: document.querySelectorAll('.wpb-grid-row').length,
}))
console.log('progressBoard=' + JSON.stringify(info))
console.log('consoleErrors=' + JSON.stringify(errors.slice(0, 8)))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-consistency-20261112/round-05-progress.png' })
