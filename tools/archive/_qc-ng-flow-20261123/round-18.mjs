// round-18.mjs —— 截图排障:打印窗口状态/可见性,再试 p1 重导航后截图
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const SHOT = 'C:/Users/vigna/ego/qc-ng-flow-20261123'
const info = {}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  info.window = w
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    info.bounds = await task.cdp('Browser.getWindowBounds', { windowId: w.windowId })
  }
} catch (e) { info.windowErr = e.message }
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP?docNo=ZJ-2026-11-0009', { timeout: 45000 })
await page.waitForTimeout(12000)
info.page = await page.evaluate(() => ({
  hash: location.hash, title: document.title,
  visibility: document.visibilityState, hidden: document.hidden,
  navCount: performance.getEntriesByType('navigation').length,
  hasFocus: document.hasFocus(),
  verdict: (document.body.innerText.match(/检验结论[^\n]{0,10}/) || [''])[0],
  ng: !!document.querySelector('.qr-band-ng'),
}))
try {
  await page.evaluate(() => { try { window.focus() } catch (e) {} })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: SHOT + '/round-18-approved-sheet.png' })
  info.shot = 'ok'
} catch (e) { info.shot = e.message.slice(0, 160) }
console.log(JSON.stringify(info, null, 2))
await task.finish({ keep: [] })
