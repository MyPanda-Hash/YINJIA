// round-22:修好手签横线后,打印媒体下再放大看页脚(4x)
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)
const fs = await import('node:fs/promises')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { log('restore skip:', e.message) }

await page.goto('file:///C:/Users/Lenovo/ego/saleout-shipnote-20261128/shipnote-20270901-HSDZ_MES.html', { timeout: 30000 })
await page.waitForTimeout(700)
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(500)

const geo = await page.evaluate(() => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom } }
  return {
    table: r('table'), note: r('.note'), sign: r('.sign'), copies: r('.copies'),
    lines: [...document.querySelectorAll('.sign i.line')].map((el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), w: Math.round(b.width) } }),
    spans: [...document.querySelectorAll('.sign span')].map((el) => { const b = el.getBoundingClientRect(); return { text: (el.textContent || '').trim(), top: Math.round(b.top), bottom: Math.round(b.bottom) } }),
  }
})
log(JSON.stringify(geo, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-22-full.png', fullPage: true })

const top = Math.max(0, (geo.table?.bottom || 200) - 6)
const res = await page.cdp('Page.captureScreenshot', {
  format: 'png',
  clip: { x: 0, y: top, width: 1000, height: Math.max(60, (geo.copies?.bottom || top + 90) - top + 10), scale: 4 },
})
await fs.writeFile('C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-22-footer-x4.png', Buffer.from(res.data, 'base64'))
log('x4 bytes=', Buffer.from(res.data, 'base64').length)
