// round-28:名字压在下划线上的签字行(6x)+ 整页
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
  const s = document.querySelector('.sign').getBoundingClientRect()
  return {
    sign: { top: s.top, bottom: s.bottom },
    cells: [...document.querySelectorAll('.sign > span')].map((el) => {
      const nm = el.querySelector('.nm')
      const ln = el.querySelector('i.line')
      const box = (x) => (x ? { w: Math.round(x.getBoundingClientRect().width), top: Math.round(x.getBoundingClientRect().top), bottom: Math.round(x.getBoundingClientRect().bottom), border: getComputedStyle(x).borderBottomWidth } : null)
      return { text: (el.textContent || '').trim(), nm: box(nm), line: box(ln) }
    }),
  }
})
log(JSON.stringify(geo, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-28-full.png', fullPage: true })
const res = await page.cdp('Page.captureScreenshot', {
  format: 'png', clip: { x: 0, y: Math.max(0, geo.sign.top - 8), width: 1060, height: Math.min(130, geo.sign.bottom - geo.sign.top + 34), scale: 6 },
})
await fs.writeFile('C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-28-sign-x6.png', Buffer.from(res.data, 'base64'))
log('saved')
