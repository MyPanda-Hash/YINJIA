/* round-08:再排障——jpeg 截图 / maximized 窗口 / 禁用动画后截图 */
const fs = await import('node:fs/promises')
const task = await taskSpace('sample-insp-20261115')
const page = await task.newPage()
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115/'
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)
const w = await page.cdp('Browser.getWindowForTarget', {})
console.log('win:', JSON.stringify(w))
try { await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'maximized' } }) } catch (e) { console.log('max err', e.message) }
await page.waitForTimeout(1200)
try { await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } }) } catch (e) { console.log('norm err', e.message) }
await page.waitForTimeout(800)
for (const opt of [{ format: 'jpeg', quality: 70 }, { format: 'png' }]) {
  try {
    const s = await page.cdp('Page.captureScreenshot', { ...opt, fromSurface: true, captureBeyondViewport: false })
    const buf = Buffer.from(s.data, 'base64')
    const name = 'round-08-shot-' + opt.format + '.' + (opt.format === 'jpeg' ? 'jpg' : 'png')
    await fs.writeFile(OUT + name, buf)
    console.log('OK', name, buf.length)
  } catch (e) { console.log('FAIL', opt.format, e.message.slice(0, 120)) }
}
// 打印到 PDF(另一条出纸链路,顺带看纸面)
try {
  const pdf = await page.cdp('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69 })
  const buf = Buffer.from(pdf.data, 'base64')
  await fs.writeFile(OUT + 'round-08-print.pdf', buf)
  console.log('PDF OK', buf.length)
} catch (e) { console.log('PDF FAIL', e.message.slice(0, 120)) }
await task.finish({ keep: 'all' })
