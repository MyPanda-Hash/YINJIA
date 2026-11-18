// shot-pdf.mjs — 用 ego 的 PDF 阅读器把落好的 PDF 渲染出来截图(校版式是否真的上了纸)
const fs = await import('node:fs/promises')
const BASE = 'D:/YINJIA-main/tools/archive/_pick-slip-pdf-20261117'
const task = await taskSpace('打印生产领料单PDF(组装+混料)')
const page = (await task.pages())[0]
const jobs = [
  ['组装', '生产领料单-GD-2026-11-0009-行1-组装-LL-2026-11-0051.pdf'],
  ['混料', '生产领料单-GD-2026-11-0009-行1-混料-LL-2026-11-0052.pdf'],
]
for (const [name, file] of jobs) {
  const url = 'file:///' + encodeURI(BASE + '/pdf/' + file)
  await page.goto(url, { timeout: 20000 })
  await page.waitForTimeout(1500)
  const p = await page.screenshot({ path: `${BASE}/pdfshot-${name}.png` })
  console.log(name, p)
}
await fs.access(BASE + '/pdfshot-组装.png')
