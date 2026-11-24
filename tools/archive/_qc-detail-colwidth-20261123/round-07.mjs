// round-07: 滚到「检验要求」看长段落是否换行显示完整;顺带确认 0 截断
const task = await taskSpace('qc-detail-expand-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 30000 })
await page.waitForTimeout(4500)

const before = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const wrap = table.querySelector('.el-scrollbar__wrap')
  const ths = [...table.querySelectorAll('.el-table__header-wrapper thead th')]
  const idx = ths.findIndex((th) => (th.innerText || '').includes('检验要求'))
  return { idx, thLeft: Math.round(ths[idx].getBoundingClientRect().left), scrollLeft: wrap.scrollLeft }
})

// 真滚轮:横向滚到检验要求列
await page.evaluate((idx) => {
  const table = document.querySelector('.report-table')
  const wrap = table.querySelector('.el-scrollbar__wrap')
  const th = table.querySelectorAll('.el-table__header-wrapper thead th')[idx]
  wrap.scrollLeft = Math.max(0, th.offsetLeft - 120)
}, before.idx)
await page.waitForTimeout(600)

const after = await page.evaluate((idx) => {
  const table = document.querySelector('.report-table')
  const trs = [...table.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const rows = []
  for (const tr of trs) {
    const cell = tr.querySelectorAll('td')[idx]?.querySelector('.cell')
    if (!cell) continue
    const h = Math.round(cell.getBoundingClientRect().height)
    if (h > 30 && rows.length < 3) {
      rows.push({
        textLen: (cell.innerText || '').length,
        cellH: h,
        scrollH: cell.scrollHeight,
        clientH: cell.clientHeight,
        clippedV: cell.scrollHeight > cell.clientHeight + 1,
        head: (cell.innerText || '').slice(0, 50),
        tail: (cell.innerText || '').slice(-30),
      })
    }
  }
  const th = table.querySelectorAll('.el-table__header-wrapper thead th')[idx]
  return { colLeft: Math.round(th.getBoundingClientRect().left), colW: Math.round(th.getBoundingClientRect().width), rows }
}, before.idx)
console.log(JSON.stringify({ before, after }, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detail-expand-20261123/round-07-scrolled.png' })
await task.finish({ keep: [] })
