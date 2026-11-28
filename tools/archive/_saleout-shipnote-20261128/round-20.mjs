// round-20:按 @media print 渲染这张出货单,并放大页脚(说明/签字行/五联)看横线
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { log('restore skip:', e.message) }

await page.goto('file:///C:/Users/Lenovo/ego/saleout-shipnote-20261128/shipnote-20270901-HSDZ_MES.html', { timeout: 30000 })
await page.waitForTimeout(800)
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(600)

// 整页(打印媒体)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-20-print-full.png', fullPage: true })

// 页脚几何 + 放大截屏
const geo = await page.evaluate(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height) }
  }
  const table = document.querySelector('table')
  const tb = table?.getBoundingClientRect()
  return {
    table: tb ? { top: Math.round(tb.top), bottom: Math.round(tb.bottom), left: Math.round(tb.left), right: Math.round(tb.right) } : null,
    note: rect('.note'),
    sign: rect('.sign'),
    copies: rect('.copies'),
    lineEls: [...document.querySelectorAll('.sign i.line')].map((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), border: cs.borderBottomWidth, display: cs.display }
    }),
    signTexts: [...document.querySelectorAll('.sign span')].map((el) => (el.textContent || '').trim()),
  }
})
log(JSON.stringify(geo, null, 2))

// 放大 2.4 倍再看(仅屏幕截图用,不改纸面)
await page.evaluate(() => { document.body.style.zoom = '2.4' })
await page.waitForTimeout(500)
const box = await page.evaluate(() => {
  const el = document.querySelector('.note')
  const r = el.getBoundingClientRect()
  return { x: Math.max(0, r.left - 20), y: Math.max(0, r.top - 30), w: Math.min(1400, r.width + 60), h: 200 }
})
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-20-footer-zoom.png', clip: { x: box.x, y: box.y, width: Math.max(200, Math.min(1200, box.w)), height: Math.min(900, box.h) } })
log('footer clip=', JSON.stringify(box))
