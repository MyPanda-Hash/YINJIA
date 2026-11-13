// round-04: 诊断截图为什么超时(windowState / 可见性),并试着截一张轻量页面。
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
const w = await page.cdp('Browser.getWindowForTarget', {})
console.log('WINDOW ' + JSON.stringify(w))
try { console.log('BOUNDS ' + JSON.stringify(await task.cdp('Browser.getWindowBounds', { windowId: w.windowId }))) } catch (e) { console.log('bounds err ' + e.message) }
try { await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', left: 40, top: 40, width: 1400, height: 900 } }) } catch (e) { console.log('set err ' + e.message) }
await page.waitForTimeout(1000)
try { console.log('BOUNDS2 ' + JSON.stringify(await task.cdp('Browser.getWindowBounds', { windowId: w.windowId }))) } catch (e) { console.log('bounds2 err ' + e.message) }
const vis = await page.evaluate(() => ({ visibility: document.visibilityState, hidden: document.hidden, inner: [innerWidth, innerHeight] }))
console.log('VIS ' + JSON.stringify(vis))
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(5000)
try {
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-btn-20261113/round-04-toolbar.png', clip: { x: 0, y: 0, width: 1400, height: 240 } })
  console.log('SHOT OK')
} catch (e) { console.log('shot err ' + e.message) }
