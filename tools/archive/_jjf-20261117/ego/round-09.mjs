const task = await taskSpace('jjf-twolevel-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_JJF?docNo=JJF-2026-11-0015', { timeout: 30000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1050 } })
} catch (e) {}
await page.waitForTimeout(800)
// 点「批准通过」(二级审批)
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn, .as-side-btns button, .as-side-btns .el-button')]
    .find((b) => (b.textContent || '').replace(/\s+/g, '') === '批准通过')
  if (!btn) return false
  btn.click()
  return true
})
console.log('clicked 批准通过:', clicked)
await page.waitForTimeout(1500)
const dlg = await page.evaluate(() => ({
  dialogs: [...document.querySelectorAll('.el-dialog, .el-message-box')].map((d) => (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)),
  inputs: [...document.querySelectorAll('.el-dialog input, .el-dialog textarea, .el-message-box input')].map((i) => ({ ph: i.placeholder || '', tag: i.tagName })),
  buttons: [...document.querySelectorAll('.el-dialog__footer button, .el-message-box__btns button')].map((b) => (b.textContent || '').trim()),
}))
console.log(JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/jjf-twolevel-20261117/r09-dialog.png' })
console.log('done')
