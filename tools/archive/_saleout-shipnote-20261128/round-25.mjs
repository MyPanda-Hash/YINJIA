// round-25:把签字行「仓管/财务/品质」三格放大 6 倍,确认当前出纸里到底有没有横线
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
  const spans = [...document.querySelectorAll('.sign span')].map((el) => {
    const b = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const kids = [...el.children].map((k) => ({ tag: k.tagName, cls: k.className, border: getComputedStyle(k).borderBottomWidth, w: Math.round(k.getBoundingClientRect().width) }))
    return { text: (el.textContent || '').trim(), top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), borderBottom: cs.borderBottomWidth, textDecoration: cs.textDecorationLine, kids }
  })
  const sign = document.querySelector('.sign')
  const sb = sign.getBoundingClientRect()
  return { sign: { top: sb.top, bottom: sb.bottom }, spans }
})
log(JSON.stringify(geo, null, 2))

// 放大整条签字行(6x)
const y = Math.max(0, geo.sign.top - 4)
const res = await page.cdp('Page.captureScreenshot', {
  format: 'png',
  clip: { x: 0, y, width: 1060, height: Math.min(120, geo.sign.bottom - y + 10), scale: 6 },
})
await fs.writeFile('C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-25-sign-x6.png', Buffer.from(res.data, 'base64'))
log('saved x6 bytes=', Buffer.from(res.data, 'base64').length)
