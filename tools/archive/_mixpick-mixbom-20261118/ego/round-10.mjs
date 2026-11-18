const task = await taskSpace(17)
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_PICK_CREATE', { timeout: 30000 })
await page.waitForTimeout(4500)
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    hash: location.hash,
    title: document.title,
    inputs: [...document.querySelectorAll('input,textarea')].map((i) => ({ ph: i.placeholder || '', val: i.value || '' })).slice(0, 15),
    buttons: [...document.querySelectorAll('button')].map(txt).filter(Boolean).slice(0, 25),
    panel: txt(document.querySelector('.mp-panel, .mpc-panel, .mp-page') || document.body).slice(0, 700),
  }
})
console.log(JSON.stringify(state, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-10-pickcreate.png' })
