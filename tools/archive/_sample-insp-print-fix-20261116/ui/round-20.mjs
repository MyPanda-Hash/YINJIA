/* round-20:再试几种宋/楷/仿宋字体,找干净的 serif 替代 */
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
    ['fangsong', '"FangSong", "STFangsong", serif'],
    ['kaiti', '"KaiTi", "STKaiti", serif'],
    ['stsong', '"STSong", "SimSun", serif'],
    ['yugothic', '"Yu Gothic", "MS PGothic", sans-serif'],
  ]) {
    el.style.fontFamily = ff
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    out[tag] = await m.domToPng(el, { scale: 1, backgroundColor: '#ffffff', width: w, height: h })
  }
  el.style.fontFamily = ''
  return out
})
for (const [k, url] of Object.entries(variants)) {
  await fs.writeFile(OUT + 'font2-' + k + '.png', Buffer.from(String(url).split(',')[1], 'base64'))
  console.log('saved font2-' + k + '.png')
}
