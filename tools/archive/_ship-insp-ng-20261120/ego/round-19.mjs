const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
const w = await page.cdp('Browser.getWindowForTarget', {})
console.log('WINDOW', JSON.stringify(w))
if (w && w.windowId) {
  await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { width: 1600, height: 1000 } })
}
await page.waitForTimeout(2500)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.approval-sheet .as-row')].slice(0, 4).map((r) => {
    const b = r.getBoundingClientRect()
    return { text: txt(r).slice(0, 60), h: Math.round(b.height) }
  })
  const cells = [...document.querySelectorAll('.approval-sheet .as-row')][3]
  return {
    inner: { w: window.innerWidth, h: window.innerHeight },
    rows,
    sheetW: Math.round(document.querySelector('.approval-sheet')?.getBoundingClientRect().width || 0),
    sheetH: Math.round(document.querySelector('.approval-sheet')?.getBoundingClientRect().height || 0),
    cellKids: cells ? [...cells.querySelectorAll('.as-cell, .q-cell, td, .as-name, .as-value')].slice(0, 12).map((e) => ({ cls: (e.className || '').toString().slice(0, 30), t: txt(e).slice(0, 20), h: Math.round(e.getBoundingClientRect().height) })) : [],
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s19-bhc-1600.png' })
