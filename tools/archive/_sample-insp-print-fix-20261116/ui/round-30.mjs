/* round-30:新空间,html2canvas 直测(判断能否作为 ic-sheet 截图引擎) */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-print-fix-20261116/'
const task = await taskSpace('print-fix-verify2-20261116')
const page = (await task.pages())[0]
console.log('space=', task.spaceId, 'page=', page.label)
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(7000)
console.log('state:', JSON.stringify(await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))))
const r = await page.evaluate(async () => {
  const el = document.querySelector('.ic-sheet')
  let mod = null
  for (const p of ['/@fs/C:/Users/vigna/.dsh/../nonexist', '/node_modules/html2canvas/dist/html2canvas.esm.js', '/@fs/D:/workspace/yinjia/frontend/node_modules/html2canvas/dist/html2canvas.esm.js']) {
    try { mod = await import(p); break } catch (e) { /* try next */ }
  }
  if (!mod) return { err: 'no html2canvas module' }
  const h2c = mod.default || mod
  const canvas = await h2c(el, { backgroundColor: '#ffffff', scale: 2, logging: false, width: el.scrollWidth, height: el.scrollHeight, windowWidth: 1600 })
  return { w: canvas.width, h: canvas.height, url: canvas.toDataURL('image/png') }
})
if (r.err) console.log('h2c err:', r.err)
else {
  await fs.writeFile(OUT + 'h2c.png', Buffer.from(String(r.url).split(',')[1], 'base64'))
  console.log('saved h2c.png', r.w, r.h)
}
