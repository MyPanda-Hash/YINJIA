// round-05: 回归看两张其它报表(库存状况表 / 报工记录)有没有被内容自适应列宽搞坏
const task = await taskSpace('qc-detail-expand-20261123')
const page = task.page('p1')

const stat = async (route, tag) => {
  await page.goto('http://localhost:5173/#' + route, { timeout: 30000 })
  await page.waitForTimeout(4500)
  const r = await page.evaluate(() => {
    const table = document.querySelector('.report-table')
    if (!table) return { ok: false, body: document.body.innerText.slice(0, 200) }
    const ths = [...table.querySelectorAll('.el-table__header-wrapper thead th')]
    const trs = [...table.querySelectorAll('.el-table__body-wrapper tbody tr')]
    const wrap = table.querySelector('.el-scrollbar__wrap')
    let truncated = 0
    const wide = []
    ths.forEach((th, i) => {
      let t = 0
      for (const tr of trs) {
        const cell = tr.querySelectorAll('td')[i]?.querySelector('.cell')
        if (!cell) continue
        if (cell.scrollWidth > cell.clientWidth + 1) t++
        const h = cell.getBoundingClientRect().height
        if (h > cell.clientHeight + 1) t++
      }
      if (t) { truncated += t; wide.push({ col: (th.innerText || '').trim().slice(0, 12), t }) }
    })
    return {
      ok: true,
      cols: ths.length,
      rows: trs.length,
      tableClientW: table.clientWidth,
      scrollW: wrap ? wrap.scrollWidth : null,
      truncatedCells: truncated,
      clippedCols: wide.slice(0, 8),
    }
  })
  await page.screenshot({ path: `C:/Users/vigna/ego/qc-detail-expand-20261123/round-05-${tag}.png` })
  return { tag, route, ...r }
}

const out = []
out.push(await stat('/panelx/list/STOCK_BALANCE', 'stock-balance'))
out.push(await stat('/panelx/list/WO_REPORT_LIST', 'wo-report'))
out.push(await stat('/panelx/list/BARCODE_MAT', 'barcode-mat'))
console.log(JSON.stringify(out, null, 1))
await task.finish({ keep: [] })
