const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
const w = await page.cdp('Browser.getWindowForTarget', {})
console.log('WINDOW0', JSON.stringify(w))
try {
  await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
  await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { left: 0, top: 0, width: 1600, height: 1000, windowState: 'normal' } })
} catch (e) { console.log('resize err', e.message) }
await page.waitForTimeout(2000)
const w2 = await page.cdp('Browser.getWindowForTarget', {})
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.approval-sheet .as-row')].slice(0, 4).map((r) => ({ text: txt(r).slice(0, 40), h: Math.round(r.getBoundingClientRect().height) }))
  return {
    inner: { w: window.innerWidth, h: window.innerHeight },
    sheetW: Math.round(document.querySelector('.approval-sheet')?.getBoundingClientRect().width || 0),
    sheetH: Math.round(document.querySelector('.approval-sheet')?.getBoundingClientRect().height || 0),
    rows,
  }
})
console.log('WINDOW1', JSON.stringify(w2))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s20-wide.png' })
