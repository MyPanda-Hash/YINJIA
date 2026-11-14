/* round-05:最小化排障——能不能对 5173 首页截图(排除页面本身的问题) */
const task = await taskSpace('sample-insp-20261115')
const page = await task.newPage()
await page.goto('http://localhost:5173/', { timeout: 60000 })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  console.log('win:', JSON.stringify(w))
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(800)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log('hash:', await page.evaluate(() => location.href))
try {
  const r = await page.screenshot({ path: 'C:/Users/vigna/ego/sample-insp-20261115/round-05-home.png' })
  console.log('shot ok:', JSON.stringify(r))
} catch (e) { console.log('shot FAIL:', e.message) }
await task.finish({ keep: true })
