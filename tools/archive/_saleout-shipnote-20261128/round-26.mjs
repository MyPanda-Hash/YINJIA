// round-26:五格都有手签横线后的签字行(6x 放大)+ 整页
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
  const sign = document.querySelector('.sign').getBoundingClientRect()
  return {
    sign: { top: sign.top, bottom: sign.bottom },
    lines: [...document.querySelectorAll('.sign i.line')].map((el) => {
      const b = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), w: Math.round(b.width), border: cs.borderBottomWidth }
    }),
    texts: [...document.querySelectorAll('.sign span')].map((el) => (el.textContent || '').trim()),
  }
})
log(JSON.stringify(geo, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-26-full.png', fullPage: true })
const y = Math.max(0, geo.sign.top - 6)
const res = await page.cdp('Page.captureScreenshot', {
  format: 'png', clip: { x: 0, y, width: 1060, height: Math.min(120, geo.sign.bottom - y + 12), scale: 6 },
})
await fs.writeFile('C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-26-sign5-x6.png', Buffer.from(res.data, 'base64'))
log('saved')
