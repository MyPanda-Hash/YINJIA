// round-21:用 CDP 截「页脚放大图」(clip + scale),看清说明/签字行/五联的横线位置
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
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right } }
  return { note: r('.note'), sign: r('.sign'), copies: r('.copies'), table: r('table') }
})
log('geo=', JSON.stringify(geo))

const shot = async (clip, scale, name) => {
  const res = await page.cdp('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale } })
  const data = res?.data || res?.screenshot?.data || ''
  await fs.writeFile(`C:/Users/Lenovo/ego/saleout-shipnote-20261128/${name}`, Buffer.from(data, 'base64'))
  log(name, 'bytes=', Buffer.from(data, 'base64').length)
}
const top = Math.max(0, (geo.table?.bottom || 200) - 6)
await shot({ x: 0, y: top, width: 1000, height: Math.max(60, (geo.copies?.bottom || top + 90) - top + 8) }, 4, 'round-21-footer-x4.png')
await shot({ x: 0, y: Math.max(0, (geo.sign?.top || 290) - 26), width: 700, height: 60 }, 6, 'round-21-sign-x6.png')
