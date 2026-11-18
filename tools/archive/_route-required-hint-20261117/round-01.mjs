const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  hasLogin: !!document.querySelector('input[placeholder*="账号"], input[placeholder*="密码"]'),
  selects: [...document.querySelectorAll('.el-select, select')].slice(0, 6).map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
  buttons: [...document.querySelectorAll('button')].slice(0, 12).map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20)),
  bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-01.png' })
