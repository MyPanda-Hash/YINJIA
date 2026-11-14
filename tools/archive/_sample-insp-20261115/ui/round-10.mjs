/* round-10:用页面内 modern-screenshot(domToPng)把纸面栅格化成 PNG —— 绕过 CDP captureScreenshot */
const fs = await import('node:fs/promises')
const task = await taskSpace(5)
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(6000)
console.log('hash:', await page.evaluate(() => location.hash))
const dataUrl = await page.evaluate(async () => {
  const el = document.querySelector('.ic-sheet')
  if (!el) return { err: 'no .ic-sheet' }
  const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
  const fn = m.domToPng || m.toPng || m.domToPng
  const url = await fn(el, { scale: 1.5, backgroundColor: '#ffffff' })
  return { url }
})
if (dataUrl.err) { console.log('ERR', dataUrl.err); process.exit(1) }
const b64 = String(dataUrl.url).split(',')[1]
const buf = Buffer.from(b64, 'base64')
await fs.writeFile('C:/Users/vigna/ego/sample-insp-20261115/round-10-sheet.png', buf)
console.log('PNG bytes:', buf.length)
await task.finish({ keep: ['p1'] })
