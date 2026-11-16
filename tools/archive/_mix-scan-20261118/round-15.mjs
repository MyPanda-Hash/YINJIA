// round-15.mjs — 打开打印代理生成的《成型配料记录》A4 PDF,截一张图看版面
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.goto('file:///D:/YINJIA-main/.tmp/mixpdf3/label_L0_20261116-145745-857.pdf', { timeout: 40000 })
await page.waitForTimeout(3500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify({ url: await page.url(), title: await page.title() }))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r15-a4sheet.png' })
