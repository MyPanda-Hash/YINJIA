// measure-qr.mjs — 量「物料码纸」几何(card 是否占满版心、QR 尺寸)
const fs = await import('node:fs/promises')
const BASE = 'D:/YINJIA-main/tools/archive/_pick-slip-pdf-20261117'
const task = await taskSpace('打印物料编码二维码(组装+混料)')
const page = (await task.pages())[0]
const html = await fs.readFile(`${BASE}/qr-组装.html`, 'utf8')
await page.goto('about:blank')
await page.evaluate((h) => { document.open(); document.write(h); document.close() }, html)
await page.waitForTimeout(300)
const m = await page.evaluate(() => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) } }
  return { dpr: devicePixelRatio, sheet: r('.sheet'), grid: r('.grid'), card: r('.card'), qr: r('.q'), mm: +(document.querySelector('.sheet').getBoundingClientRect().width / 210).toFixed(4) }
})
console.log(JSON.stringify(m, null, 2))
