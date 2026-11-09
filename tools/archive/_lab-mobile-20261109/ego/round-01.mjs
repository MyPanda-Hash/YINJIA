const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
const info = await page.evaluate(() => ({
  hash: location.hash,
  hasLoginForm: !!document.querySelector('input[placeholder*="账号"]'),
  inputs: [...document.querySelectorAll('input')].map((i) => i.placeholder || i.name || ''),
  selects: [...document.querySelectorAll('.el-select')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-01.png' })
console.log(await page.snapshot())
