/* round-14:把视口模拟成 A4 竖版打印内容区(733 CSS px 宽),量真实打印高并出图 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115/'
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => s.name === 'sample-insp-20261115')
const task = entry.ownership === 'user' ? await claimTaskSpace(entry.id) : await taskSpace(entry.id)
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)
try { await page.cdp('Emulation.clearDeviceMetricsOverride', {}) } catch {}
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 733, height: 1062, deviceScaleFactor: 1, mobile: false })
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.evaluate(() => document.body.classList.add('approval-printing'))
await page.waitForTimeout(1000)
const m = await page.evaluate(() => {
  const el = document.querySelector('.ic-sheet')
  const r = el?.getBoundingClientRect()
  return { w: Math.round(r?.width || 0), h: Math.round(r?.height || 0), scrollH: el?.scrollHeight || 0, viewport: window.innerWidth }
})
console.log('A4-PRINT:', JSON.stringify(m), 'A4 content height=1062 =>', m.scrollH <= 1062 ? 'ONE PAGE' : 'SPLITS to ' + Math.ceil(m.scrollH / 1062) + ' pages')
const r = await page.evaluate(async () => {
  const el = document.querySelector('.ic-sheet')
  const mm = await import('/node_modules/.vite/deps/modern-screenshot.js')
  return mm.domToPng(el, { scale: 1.4, backgroundColor: '#ffffff', width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) })
})
await fs.writeFile(OUT + 'round-14-01-a4-print.png', Buffer.from(String(r).split(',')[1], 'base64'))
console.log('shot round-14-01-a4-print.png')
await page.evaluate(() => document.body.classList.remove('approval-printing'))
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
try { await page.cdp('Emulation.clearDeviceMetricsOverride', {}) } catch {}
console.log('DONE')
