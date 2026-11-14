/* round-07:隔离排障——about:blank / 静态 svg / 应用首页,各截一张 */
const fs = await import('node:fs/promises')
const task = await taskSpace('sample-insp-20261115')
const page = await task.newPage()
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115/'
async function tryShot(name) {
  try {
    const s = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: true })
    const buf = Buffer.from(s.data, 'base64')
    await fs.writeFile(OUT + name, buf)
    console.log('OK', name, buf.length)
  } catch (e) { console.log('FAIL', name, e.message.slice(0, 160)) }
}
await page.goto('about:blank')
await page.waitForTimeout(500)
await tryShot('probe-blank.png')
await page.goto('http://localhost:5173/favicon.svg', { timeout: 30000 })
await page.waitForTimeout(800)
await tryShot('probe-svg.png')
await page.goto('http://localhost:5173/', { timeout: 60000 })
await page.waitForTimeout(6000)
await tryShot('probe-home.png')
await task.finish({ keep: 'all' })
