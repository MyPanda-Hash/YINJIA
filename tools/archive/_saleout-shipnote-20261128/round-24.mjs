// round-24:整幅页脚(含「客户」横线)放大 3 倍出图 —— 交付前后对比用
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)
const fs = await import('node:fs/promises')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { log('restore skip:', e.message) }

await page.goto('file:///C:/Users/Lenovo/ego/saleout-shipnote-20261128/shipnote-fixed-8090.html', { timeout: 30000 })
await page.waitForTimeout(700)
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(500)

const geo = await page.evaluate(() => {
  const r = (sel) => { const el = document.querySelector(sel); const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right } }
  return { table: r('table'), sign: r('.sign'), copies: r('.copies') }
})
log('geo=', JSON.stringify(geo))
const res = await page.cdp('Page.captureScreenshot', {
  format: 'png',
  clip: {
    x: 0, y: Math.max(0, geo.table.bottom - 6),
    width: Math.ceil(geo.copies.right) + 1,
    height: Math.ceil(geo.copies.bottom - geo.table.bottom + 16),
    scale: 3.4,
  },
})
await fs.writeFile('C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-24-footer-full-x34.png', Buffer.from(res.data, 'base64'))
log('bytes=', Buffer.from(res.data, 'base64').length)
