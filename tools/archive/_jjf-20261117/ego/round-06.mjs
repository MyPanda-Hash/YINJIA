const task = await taskSpace('jjf-twolevel-20261117')
const page = task.page('p1')
const no = process.env.DOC_NO || 'JJF-2026-11-0005'
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1050 } })
} catch (e) { console.log('bounds skip: ' + e.message) }
await page.waitForTimeout(600)
await page.goto(`http://localhost:5173/#/panelx/list/QC_JJF?docNo=${no}`, { timeout: 30000 })
await page.waitForTimeout(5000)
try {
  const w2 = await page.cdp('Browser.getWindowForTarget', {})
  if (w2 && w2.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w2.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.waitForTimeout(800)
// 纸面区域整体截图(取 .approval-sheet 元素截图,避免侧栏干扰)
const el = await page.evaluate(() => {
  const s = document.querySelector('.approval-sheet')
  if (!s) return null
  const r = s.getBoundingClientRect()
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(s.scrollHeight || r.height) }
})
console.log('sheet rect:', JSON.stringify(el))
await page.screenshot({ path: `C:/Users/vigna/ego/jjf-twolevel-20261117/r06-full-${no}.png`, fullPage: true })
console.log('done')
