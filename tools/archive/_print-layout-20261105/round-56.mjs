// round-56: 打开新版面的 PDF —— 看「材料名称/规格」是否完整显示(不再被截断)
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto('file:///D:/YINJIA-main/deploy/print-agent/print-out/GD-LAYOUT-1_L1_20261106-100103-735.pdf', { timeout: 30000 })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(700)
} catch (e) { console.log('restore skip: ' + e.message) }
try {
  const shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/pdf-layout-v2.png' })
  console.log({ shot })
} catch (e) { console.log('shot fail: ' + e.message) }
