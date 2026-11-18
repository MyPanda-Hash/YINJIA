const task = await taskSpace(17)
const page = task.page('p1')
await page.click('button:has-text("生成")')
await page.waitForTimeout(7000)
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    hash: location.hash,
    dialogs: [...document.querySelectorAll('.el-dialog, .el-message-box')].map(txt).slice(0, 3),
    messages: [...document.querySelectorAll('.el-message, .el-notification')].map(txt).slice(0, 5),
    body: txt(document.querySelector('.mp-panel') || document.body).slice(0, 1600),
  }
})
console.log(JSON.stringify(state, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-12-generated.png' })
