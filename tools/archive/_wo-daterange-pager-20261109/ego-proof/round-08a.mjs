// round-08a.mjs — 诊断:订单结转页当前被什么浮层挡住(截图 + 浮层文本)
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-daterange-verify-20261109'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-daterange-verify-20261109')
const page = task.page('p1')
console.log('resumed page=' + page.label + ' hash=' + (await page.evaluate(() => location.hash)))
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
const dom = await page.evaluate(() => {
  const overlays = [...document.querySelectorAll('.el-message-box, .el-dialog, .el-overlay, .el-popper, .el-message')].filter((e) => e.offsetParent !== null).map((e) => ({ cls: String(e.className).slice(0, 80), text: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200) }))
  return {
    hash: location.hash,
    title: document.title,
    overlays,
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400),
  }
})
console.log('DOM: ' + JSON.stringify(dom, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-08a-diagnose-overlay.png' })
console.log('screenshot -> ' + OUT + '/round-08a-diagnose-overlay.png')
