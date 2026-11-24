// round-04: 改后复测 —— 列宽是否按内容展开、是否还有省略号
const task = await taskSpace('qc-detail-expand-20261123')
const page = task.page('p1')
const logs = []
page.on?.('console', (m) => { if (m.type?.() === 'error') logs.push(String(m.text?.())) })
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 30000 })
await page.waitForTimeout(1200)
await page.reload?.()
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const res = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  if (!table) return { ok: false, body: document.body.innerText.slice(0, 300) }
  const ths = [...table.querySelectorAll('.el-table__header-wrapper thead th')]
  const trs = [...table.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const wrap = table.querySelector('.el-scrollbar__wrap')
  return {
    ok: true,
    rowCount: trs.length,
    tableClientW: table.clientWidth,
    bodyScrollW: wrap ? wrap.scrollWidth : null,
    bodyClientW: wrap ? wrap.clientWidth : null,
    cols: ths.map((th, i) => {
      let maxCell = 0
      let truncated = 0
      let sample = ''
      let multiLine = 0
      for (const tr of trs) {
        const cell = tr.querySelectorAll('td')[i]?.querySelector('.cell')
        if (!cell) continue
        if (cell.scrollWidth > maxCell) { maxCell = cell.scrollWidth; sample = (cell.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) }
        if (cell.scrollWidth > cell.clientWidth + 1) truncated++
        const h = cell.getBoundingClientRect().height
        if (h > 30) multiLine++
      }
      return {
        label: (th.innerText || '').replace(/\s+/g, ' ').trim(),
        thW: Math.round(th.getBoundingClientRect().width),
        maxCellW: maxCell,
        truncated,
        multiLine,
        sample,
      }
    }),
  }
})
console.log(JSON.stringify(res, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detail-expand-20261123/round-04.png' })
await task.finish({ keep: [] })
