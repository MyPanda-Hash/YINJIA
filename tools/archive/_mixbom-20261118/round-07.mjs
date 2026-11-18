const task = await taskSpace('mixbom-20261118')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.goto('http://localhost:5173/#/panelx/list/MIX_BOM?docNo=MIX-2026-11-0001', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.evaluate(() => {
  const el = document.querySelector('.app-main, .main, .left-nav')
  if (el) el.scrollTop = 0
  window.scrollTo(0, 0)
})
await page.waitForTimeout(500)
const info = await page.evaluate(() => ({
  doc: document.body.innerText.match(/单据：\s*\S+/)?.[0] || '',
  pageNav: document.body.innerText.match(/第\s*\d+\/\d+\s*张/)?.[0] || '',
  text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 900),
}))
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/mixbom-20261118/07-mix-doc-1.png' })
