const task = await taskSpace('finish-in-failqty')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', left: 0, top: 0, width: 1600, height: 1000 } })
  }
} catch (e) { console.log('bounds skip: ' + e.message) }
await page.waitForTimeout(800)
const info = await page.evaluate(() => {
  const tables = [...document.querySelectorAll('.el-table')]
  const t = tables[tables.length - 1]
  if (t) t.scrollIntoView({ block: 'center' })
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').trim())
  const i = heads.findIndex((h) => h.startsWith('不合格数量'))
  const row = document.querySelector('.el-table__body tr')
  let cellHtml = ''
  let cellInput = null
  if (row && i >= 0) {
    const cells = [...row.querySelectorAll('td')]
    const c = cells[i]
    cellHtml = c ? c.outerHTML.slice(0, 700) : '(no cell)'
    const inp = c ? c.querySelector('input') : null
    cellInput = inp ? { value: inp.value, type: inp.type } : null
  }
  return { heads, failIdx: i, cellHtml, cellInput, scrollY: window.scrollY }
})
console.log(JSON.stringify(info, null, 2))
await page.waitForTimeout(600)
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/finish-in-gate-qty/ego/round-04-grid.png' })
console.log('shot ok')
