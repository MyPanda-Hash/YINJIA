const task = await taskSpace('mix-bom-switch-verify-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-09-0135&line=1', { timeout: 30000 })
await page.waitForTimeout(6000)
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    hash: location.hash,
    title: document.title,
    factory: txt(document.querySelector('.factory-name')),
    kv: [...document.querySelectorAll('.mp-kv')].map(txt),
    rows: [...document.querySelectorAll('.mp-line')].map(txt),
    body: txt(document.body).slice(0, 120),
  }
})
console.log(JSON.stringify(state, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-14-after-restart.png' })
console.log('space=' + task.spaceId)
