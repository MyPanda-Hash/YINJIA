// measure-slip.mjs — 量纸面几何(卡片/表格是否占满 210mm)
const fs = await import('node:fs/promises')
const BASE = 'D:/YINJIA-main/tools/archive/_pick-slip-pdf-20261117'
const task = await taskSpace('打印生产领料单PDF(组装+混料)')
const page = (await task.pages())[0]
const html = await fs.readFile(`${BASE}/slip-组装.html`, 'utf8')
await page.goto('about:blank')
await page.evaluate((h) => { document.open(); document.write(h); document.close() }, html)
await page.waitForTimeout(300)
const m = await page.evaluate(() => {
  const card = document.querySelector('.card')
  const tb = document.querySelector('table')
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height) } }
  return {
    dpr: window.devicePixelRatio,
    inner: { w: window.innerWidth, h: window.innerHeight },
    card: r(card),
    table: r(tb),
    pxPerMm: card.getBoundingClientRect().width / 210,
  }
})
console.log(JSON.stringify(m, null, 2))
