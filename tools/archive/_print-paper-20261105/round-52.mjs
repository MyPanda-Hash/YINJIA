// round-52: 截「自动打印」页的打印电脑那一行(含纸张下拉)
const task = await taskSpace(1)
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await page.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(700)
} catch (e) { console.log('restore skip: ' + e.message) }
try {
  const shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/panel-paper.png' })
  console.log({ shot })
} catch (e) { console.log('shot fail: ' + e.message) }
