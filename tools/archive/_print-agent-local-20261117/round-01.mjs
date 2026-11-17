const task = await taskSpace('print-agent-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 30000 })
await page.waitForTimeout(5000)
const info = await page.evaluate(() => ({
  hash: location.hash,
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 700),
  switches: [...document.querySelectorAll('.el-switch')].map((s) => s.className),
}))
console.log(JSON.stringify(info, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/print-agent-20261117/printStation.png' })
