// round-60: 单位列「支（成型前）」是否完整(自适应缩字号/折行)
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto('file:///D:/YINJIA-main/deploy/print-agent/print-out/GD-UNIT-4_L3_20261106-112335-320.pdf', { timeout: 30000 })
await page.waitForTimeout(2500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
} catch (e) { console.log('restore skip: ' + e.message) }
try {
  const shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/pdf-unit-fit4.png' })
  console.log({ shot })
} catch (e) { console.log('shot fail: ' + e.message) }
