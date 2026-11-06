// round-57: 折行版式核对(材料名称/规格是否完整,不再被裁)
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto('file:///D:/YINJIA-main/deploy/print-agent/print-out/GD-WRAP-1_L1_20261106-100328-665.pdf', { timeout: 30000 })
await page.waitForTimeout(2500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
} catch (e) { console.log('restore skip: ' + e.message) }
try {
  const shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/pdf-wrap-v3.png' })
  console.log({ shot })
} catch (e) { console.log('shot fail: ' + e.message) }
