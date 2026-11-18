const task = await taskSpace(17)
const page = task.page('p1')
await page.fill('input[placeholder="扫工单码 / 输入工单号或混料单号"]', 'GD-2026-09-0135')
await page.click('button:has-text("打开单据")')
await page.waitForTimeout(5000)
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.mp-line')].map((el) => txt(el))
  const kv = [...document.querySelectorAll('.mp-kv')].map((el) => txt(el))
  return {
    hash: location.hash,
    title: document.title,
    kv,
    rowCount: rows.length,
    rows: rows.slice(0, 8),
    body: txt(document.querySelector('.mm-panel') || document.body).slice(0, 900),
  }
})
console.log(JSON.stringify(state, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-03-mixdoc.png' })
