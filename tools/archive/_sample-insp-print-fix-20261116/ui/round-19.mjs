/* round-19:字体变体对比 —— 找出 modern-screenshot 下不重叠的「宋体类」字体 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-print-fix-20261116/'
const task = await taskSpace(6)
const page = (await task.pages())[0]
const variants = await page.evaluate(async () => {
  const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
  const el = document.querySelector('.ic-sheet')
  const w = Math.max(el.scrollWidth, el.offsetWidth)
  const h = Math.max(el.scrollHeight, el.offsetHeight)
  const out = {}
  for (const [tag, ff] of [
    ['serif', 'serif'],
    ['nsimsun', '"NSimSun", serif'],
    ['songti', '"Songti SC", "Noto Serif SC", serif'],
    ['simsun', 'SimSun, serif'],
  ]) {
    el.style.fontFamily = ff
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    out[tag] = await m.domToPng(el, { scale: 1, backgroundColor: '#ffffff', width: w, height: h })
  }
  el.style.fontFamily = ''
  return out
})
for (const [k, url] of Object.entries(variants)) {
  await fs.writeFile(OUT + 'font-' + k + '.png', Buffer.from(String(url).split(',')[1], 'base64'))
  console.log('saved font-' + k + '.png')
}
