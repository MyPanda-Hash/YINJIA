// shot-slips.mjs — 两张纸面 HTML 的目检截图(ego;210mm×148.5mm ≈ 794×561 CSS px)
const fs = await import('node:fs/promises')
const BASE = 'D:/YINJIA-main/tools/archive/_pick-slip-pdf-20261117'
const task = await taskSpace('打印生产领料单PDF(组装+混料)')
const page = (await task.pages())[0]
for (const [name, file] of [['组装', 'slip-组装.html'], ['混料', 'slip-混料.html']]) {
  const html = await fs.readFile(`${BASE}/${file}`, 'utf8')
  await page.goto('about:blank')
  await page.evaluate((h) => { document.open(); document.write(h); document.close() }, html)
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0), undefined, { timeout: 10000 })
  const p = await page.screenshot({ path: `${BASE}/shot-${name}.png` })
  console.log(name, p)
}
