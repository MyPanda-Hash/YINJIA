const task = await taskSpace(17)
const page = task.page('p1')
await page.click('text=GD-2026-09-0135#1')
await page.waitForTimeout(5000)
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.mp-line')].map(txt)
  const kv = [...document.querySelectorAll('.mp-kv')].map(txt)
  return {
    hash: location.hash,
    kv,
    rowCount: rows.length,
    rows,
    progress: txt(document.querySelector('.mp-progress')),
    err: txt(document.querySelector('.mp-err')),
    body: txt(document.querySelector('.mm-panel') || document.body).slice(0, 1200),
  }
})
console.log(JSON.stringify(state, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-04-mixdoc-detail.png' })
