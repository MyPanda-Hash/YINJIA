const task = await taskSpace('mixbom-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MIX_BOM', { timeout: 30000 })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) {}
// 上一张:切到 烧结工艺清单 那张(MIX-2026-11-0001)
const before = await page.evaluate(() => document.body.innerText.match(/单据：\s*\S+/)?.[0] || '')
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button, .as-side-btn, .tb-main, span')].find((b) => (b.textContent || '').trim() === '◀')
  if (btn) btn.click()
})
await page.waitForTimeout(1500)
const after = await page.evaluate(() => ({
  doc: document.body.innerText.match(/单据：\s*\S+/)?.[0] || '',
  text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 700),
}))
console.log('BEFORE', before)
console.log('AFTER', JSON.stringify(after, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/mixbom-20261118/06-mix-doc.png' })
