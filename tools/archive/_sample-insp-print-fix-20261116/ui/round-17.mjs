/* round-17:变体实验 —— 换字体 / 去 letter-spacing / 换 line-height */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-print-fix-20261116/'
const task = await taskSpace(6)
const page = (await task.pages())[0]
const variants = await page.evaluate(async () => {
  const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
  const el = document.querySelector('.ic-sheet')
  const w = Math.max(el.scrollWidth, el.offsetWidth)
  const h = Math.max(el.scrollHeight, el.offsetHeight)
  const results = {}
  const cap = async (tag) => { results[tag] = await m.domToPng(el, { scale: 1.3, backgroundColor: '#ffffff', width: w, height: h }) }
  await cap('base')
  const oldFF = el.style.fontFamily
  el.style.fontFamily = '"Microsoft YaHei", sans-serif'
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  await cap('yahei')
  el.style.fontFamily = oldFF
  // 去掉所有 letter-spacing
  const spans = [...el.querySelectorAll('*')]
  const olds = spans.map((n) => n.style.letterSpacing)
  spans.forEach((n) => { n.style.letterSpacing = 'normal' })
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  await cap('noletterspacing')
  spans.forEach((n, i) => { n.style.letterSpacing = olds[i] })
  return results
})
for (const [k, url] of Object.entries(variants)) {
  await fs.writeFile(OUT + 'variant-' + k + '.png', Buffer.from(String(url).split(',')[1], 'base64'))
  console.log('saved variant-' + k + '.png')
}
