// round-03: 从 DOM 量每列「内容真实宽度」(.cell scrollWidth)与当前列宽,统计被截断的列
const task = await taskSpace('qc-detail-expand-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 30000 })
await page.waitForTimeout(4000)

const res = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  if (!table) return { ok: false, body: document.body.innerText.slice(0, 200) }
  const ths = [...table.querySelectorAll('.el-table__header-wrapper thead th')]
  const trs = [...table.querySelectorAll('.el-table__body-wrapper tbody tr')]
  return {
    ok: true,
    rowCount: trs.length,
    cols: ths.map((th, i) => {
      let maxCell = 0
      let truncated = 0
      let sample = ''
      for (const tr of trs) {
        const cell = tr.querySelectorAll('td')[i]?.querySelector('.cell')
        if (!cell) continue
        if (cell.scrollWidth > maxCell) { maxCell = cell.scrollWidth; sample = (cell.innerText || '').replace(/\s+/g, ' ').trim() }
        if (cell.scrollWidth > cell.clientWidth + 1) truncated++
      }
      return {
        label: (th.innerText || '').replace(/\s+/g, ' ').trim(),
        thW: Math.round(th.getBoundingClientRect().width),
        maxCellW: maxCell,
        truncated,
        sample,
      }
    }),
  }
})
console.log(JSON.stringify(res, null, 1))
await task.finish({ keep: [] })
