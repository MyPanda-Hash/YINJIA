// shot-qr-sheets.mjs — 物料码纸 A 4 的整页截图(用于二维码解码复核)
const fs = await import('node:fs/promises')
const BASE = 'D:/YINJIA-main/tools/archive/_pick-slip-pdf-20261117'
const task = await taskSpace('打印物料编码二维码(组装+混料)')
const page = (await task.pages())[0]
for (const [name, file] of [['组装', 'qr-组装.html'], ['混料', 'qr-混料.html']]) {
  const html = await fs.readFile(`${BASE}/${file}`, 'utf8')
  await page.goto('about:blank')
  await page.evaluate((h) => { document.open(); document.write(h); document.close() }, html)
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0), undefined, { timeout: 10000 })
  const p = await page.screenshot({ path: `${BASE}/qrsheet-${name}.png`, fullPage: true })
  console.log(name, p)
}
