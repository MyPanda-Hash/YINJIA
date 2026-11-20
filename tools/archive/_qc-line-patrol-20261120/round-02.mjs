const task = await taskSpace('qc-line-patrol-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 30000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1600, height: 1000 } })
  await page.waitForTimeout(600)
} catch (e) { console.log('restore skip: ' + e.message) }
const info = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    sideBtns: [...document.querySelectorAll('.as-side-btn')].map(txt),
    toolbarBtns: [...document.querySelectorAll('.tools button, .func-zone button')].map(txt).slice(0, 40),
    ths: [...document.querySelectorAll('.lp-sheet thead th')].map(txt),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/lp/ego/02-existing.png' })
await task.finish({ keep: [] })
