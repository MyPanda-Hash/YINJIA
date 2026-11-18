const task = await taskSpace('material-ret-fix-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MATERIAL_RET', { timeout: 40000 })
await page.waitForTimeout(4000)
const state = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const body = txt(document.body)
  return {
    hash: location.hash,
    hasError: body.includes('服务异常') || body.includes('列名'),
    errorSnippet: (body.match(/服务异常[^。]{0,120}/) || [''])[0],
    docNo: (document.querySelector('input') || {}).value || null,
    headerCells: [...document.querySelectorAll('th')].map(txt).filter(Boolean).slice(0, 22),
    gridHeader: [...document.querySelectorAll('.el-table__header th, .grid-head th, thead th')].map(txt).filter(Boolean).slice(0, 30),
  }
})
console.log(JSON.stringify(state, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/material-ret-fix-20261117/round-06-materialret.png' })
