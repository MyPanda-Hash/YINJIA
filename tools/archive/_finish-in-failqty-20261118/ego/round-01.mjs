const task = await taskSpace('finish-in-failqty')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(3500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 800),
  inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, type: i.type, value: i.value })),
  selects: [...document.querySelectorAll('.el-select')].map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim()),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
})), null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/finish-in-gate-qty/ego/round-01-login.png' })
console.log('shot ok')
