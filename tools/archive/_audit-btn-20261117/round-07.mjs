const task = await taskSpace('audit-direct-audit-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 30000 })
await page.waitForTimeout(12000)
console.log(JSON.stringify(await page.evaluate(() => ({
  title: document.title,
  htmlLen: document.documentElement.outerHTML.length,
  appHtmlLen: (document.querySelector('#app')?.innerHTML || '').length,
  scripts: [...document.querySelectorAll('script')].map((s) => s.src || s.type).slice(0, 8),
  bodyLen: document.body.innerText.length,
})), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-direct-audit-20261117/diag-5173-b.png' })
