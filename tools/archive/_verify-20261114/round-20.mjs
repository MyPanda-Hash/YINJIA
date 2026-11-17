// round-20 — 在浏览器里打开服务端报表 PDF(file://)截图取证
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.goto('file:///C:/Users/vigna/ego/verify-20261114/a4-server-report.pdf', { timeout: 40000 })
await page.waitForTimeout(6000)
const st = await page.evaluate(() => ({ url: location.href, title: document.title, body: document.body ? document.body.tagName : null }))
console.log('STATE=' + JSON.stringify(st))
await page.screenshot({ path: OUT + '/round-20-a4-server-report.png' })
console.log('DONE round-20')
