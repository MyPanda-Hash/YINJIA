// round-17:去掉空行后重新截图样张
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip:', e.message) }
await page.goto('file:///D:/YINJIA-main/_scratch/shipnote-sample.html', { timeout: 30000 })
await page.waitForTimeout(1000)
log((await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-17-sample2.png', fullPage: true })
