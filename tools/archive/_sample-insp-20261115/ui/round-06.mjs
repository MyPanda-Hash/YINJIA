/* round-06:用 CDP 直接截图(绕过 page.screenshot 的滚动/导航包装) */
const fs = await import('node:fs/promises')
const task = await taskSpace('sample-insp-20261115')
const page = await task.newPage()
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(800)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log('hash:', await page.evaluate(() => location.hash))
const shot = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: true })
const buf = Buffer.from(shot.data, 'base64')
const out = 'C:/Users/vigna/ego/sample-insp-20261115/round-06-cdp.png'
await fs.writeFile(out, buf)
console.log('cdp shot bytes:', buf.length, '=>', out)
await task.finish({ keep: 'all' })
