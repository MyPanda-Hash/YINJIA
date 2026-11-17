/* round-09:claim 回本 goal 的 space,再试截图(fromSurface true/false) */
const fs = await import('node:fs/promises')
const spaces = await listTaskSpaces()
console.log('spaces:', JSON.stringify(spaces.slice(-5)))
const entry = spaces.find((s) => s.name === 'sample-insp-20261115')
const task = entry.ownership === 'user' ? await claimTaskSpace(entry.id) : await taskSpace(entry.id)
console.log('claimed:', task.spaceId, task.ownership)
const pages0 = await task.pages()
console.log('pages:', pages0.map((p) => p.label))
let page = pages0[0]
if (!page) {
  const tabs = await task.tabs()
  page = tabs.length ? await task.adopt(tabs[0].page) : await task.newPage()
}
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(800)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log('hash:', await page.evaluate(() => location.hash))
for (const surface of [false, true]) {
  try {
    const s = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: surface })
    const buf = Buffer.from(s.data, 'base64')
    await fs.writeFile('C:/Users/vigna/ego/sample-insp-20261115/round-09-surface-' + surface + '.png', buf)
    console.log('OK surface=' + surface, buf.length)
    break
  } catch (e) { console.log('FAIL surface=' + surface, e.message.slice(0, 100)) }
}
