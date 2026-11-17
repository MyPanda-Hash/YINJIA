// print-qr-pdf.mjs — 两张「物料编码二维码」A4 纸落 PDF(@page A4 竖版)
const fs = await import('node:fs/promises')

const BASE = 'D:/YINJIA-main/tools/archive/_pick-slip-pdf-20261117'
const OUT = BASE + '/pdf'
const jobs = [
  { html: BASE + '/qr-组装.html', pdf: OUT + '/物料码二维码-GD-2026-11-0009-行1-组装-LL-2026-11-0051.pdf' },
  { html: BASE + '/qr-混料.html', pdf: OUT + '/物料码二维码-GD-2026-11-0009-行1-混料-LL-2026-11-0052.pdf' },
]
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('打印物料编码二维码(组装+混料)')
const page = task.page('p1')
const done = []
for (const j of jobs) {
  const html = await fs.readFile(j.html, 'utf8')
  await page.goto('about:blank')
  await page.evaluate((h) => { document.open(); document.write(h); document.close() }, html)
  await page.waitForFunction(
    () => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0),
    undefined,
    { timeout: 10000 },
  )
  const res = await page.cdp('Page.printToPDF', { printBackground: true, preferCSSPageSize: true })
  const b64 = res?.data ?? res?.result?.data
  if (!b64) { console.log('printToPDF 返回体:', JSON.stringify(res).slice(0, 400)); throw new Error('printToPDF 没有拿到 PDF 数据') }
  const buf = Buffer.from(b64, 'base64')
  await fs.writeFile(j.pdf, buf)
  done.push({ pdf: j.pdf, bytes: buf.length })
}
console.log(JSON.stringify({ spaceId: task.spaceId, done }, null, 2))
