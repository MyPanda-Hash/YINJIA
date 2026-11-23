// round-09: 新开干净页签, 重新加载列表
const task = await taskSpace('qc-8fix-20261123')
const page = await task.newPage()
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
console.log(JSON.stringify(await page.evaluate(() => ({
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1600),
  tables: [...document.querySelectorAll('table')].map((t) => (t.innerText || '').replace(/\s+/g, ' ').slice(0, 200)),
})), null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-09.png' })
