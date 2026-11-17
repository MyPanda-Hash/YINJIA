// round-15:本月 + 按委托单,横向滚到「检测项目数」列,截图确认表头文字与排序箭头同一行
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(2500)
await page.evaluate(() => [...document.querySelectorAll('.iss-tabs .el-tabs__item')].find((n) => (n.textContent || '').includes('按委托单'))?.click())
await page.waitForTimeout(1200)
const info = await page.evaluate(() => {
  const pane = [...document.querySelectorAll('.iss-tabs .el-tab-pane')][1]
  const wrap = pane?.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
  if (wrap) wrap.scrollLeft = 420
  const th = [...(pane?.querySelectorAll('.el-table__header th') || [])].find((n) => (n.textContent || '').includes('检测项目数'))
  const cell = th?.querySelector('.cell')
  const caret = th?.querySelector('.caret-wrapper')
  return {
    scrolled: wrap ? wrap.scrollLeft : -1,
    head: th ? (th.textContent || '').replace(/\s+/g, ' ').trim() : '',
    thW: th ? Math.round(th.getBoundingClientRect().width) : 0,
    cellH: cell ? Math.round(cell.getBoundingClientRect().height) : 0,
    caretTop: cell && caret ? Math.round(caret.getBoundingClientRect().top - cell.getBoundingClientRect().top) : -1,
  }
})
console.log(JSON.stringify(info))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/15-headers-fixed.png` })
await task.finish({ keep: [] })
