import fs from 'node:fs/promises'

const OUT = 'C:/Users/Lenovo/ego/purchase-in-source-20261111'
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('purchase-in-source-20261111')
const page = task.page('p1')

await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.goto('http://localhost:5173/#/login', { timeout: 40000 })
await page.waitForTimeout(2500)
await page.reload().catch(() => {})
await page.waitForTimeout(3000)

const info = await page.evaluate(() => ({
  hash: location.hash,
  inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, type: i.type, val: i.value })),
  selects: [...document.querySelectorAll('.el-select')].map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim()),
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
}))
console.log(JSON.stringify(info, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/r02-login.png' })
console.log('shot=r02-login.png')
