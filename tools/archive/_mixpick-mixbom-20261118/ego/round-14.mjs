const SPACE_ID = 17
const task = await claimTaskSpace(SPACE_ID)
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))
await page.reload({ timeout: 30000 })
await page.waitForTimeout(5000)
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    hash: location.hash,
    factory: txt(document.querySelector('.factory-name')),
    rows: [...document.querySelectorAll('.mp-line')].map(txt),
  }
})
console.log(JSON.stringify(state, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-14-after-restart.png' })
console.log('page=' + page.label)
