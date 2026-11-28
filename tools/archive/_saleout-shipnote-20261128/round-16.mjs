// round-16:把出货单纸面(样张 + 真单)在浏览器里按 A4 渲染并截图核对
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip:', e.message) }

// ① 样张(用户截图同数据):同物料两批合并
await page.goto('file:///D:/YINJIA-main/_scratch/shipnote-sample.html', { timeout: 30000 })
await page.waitForTimeout(1200)
const t1 = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim())
log('样张文本=', t1)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-16-sample.png', fullPage: true })

// ② 真单(正式库 XSCK-20261126-00009 那张,经真实按钮产出的打印层 HTML)
await page.goto('file:///C:/Users/Lenovo/ego/saleout-shipnote-20261128/shipnote-printed.html', { timeout: 30000 })
await page.waitForTimeout(1200)
const t2 = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim())
log('真单文本=', t2)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-16-real.png', fullPage: true })
