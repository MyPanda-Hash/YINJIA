/* round-13:真实打印态(body.approval-printing + media=print)尺寸与分页判定 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115/'
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => s.name === 'sample-insp-20261115')
const task = entry.ownership === 'user' ? await claimTaskSpace(entry.id) : await taskSpace(entry.id)
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.evaluate(() => document.body.classList.add('approval-printing'))
await page.waitForTimeout(800)
const m = await page.evaluate(() => {
  const el = document.querySelector('.ic-sheet')
  const r = el?.getBoundingClientRect()
  const cs = el ? getComputedStyle(el) : null
  return {
    w: Math.round(r?.width || 0), h: Math.round(r?.height || 0),
    scrollH: el?.scrollHeight || 0,
    fontSize: cs?.fontSize, padding: cs?.padding,
    mediaPrint: window.matchMedia('print').matches,
  }
})
console.log('PRINT-TRUE:', JSON.stringify(m))
// 栅格化打印态纸面
const r = await page.evaluate(async () => {
  const el = document.querySelector('.ic-sheet')
  const mm = await import('/node_modules/.vite/deps/modern-screenshot.js')
  const url = await mm.domToPng(el, { scale: 1.4, backgroundColor: '#ffffff', width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) })
  return url
})
await fs.writeFile(OUT + 'round-13-01-print-true.png', Buffer.from(String(r).split(',')[1], 'base64'))
console.log('shot round-13-01-print-true.png')
await page.evaluate(() => document.body.classList.remove('approval-printing'))
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
console.log('DONE')
