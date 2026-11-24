// round-06: 材料仓条码管理 单据编号列为什么还有截断(看列宽/内容/样式/是否 wrap)
const task = await taskSpace('qc-detail-expand-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/BARCODE_MAT', { timeout: 30000 })
await page.waitForTimeout(4500)
const r = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  if (!table) return { ok: false, body: document.body.innerText.slice(0, 200) }
  const ths = [...table.querySelectorAll('.el-table__header-wrapper thead th')]
  const trs = [...table.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const idx = ths.findIndex((th) => (th.innerText || '').includes('单据编号'))
  const bad = []
  for (let i = 0; i < trs.length; i++) {
    const cell = trs[i].querySelectorAll('td')[idx]?.querySelector('.cell')
    if (!cell) continue
    if (cell.scrollWidth > cell.clientWidth + 1) {
      const cs = getComputedStyle(cell)
      bad.push({
        i,
        text: (cell.innerText || '').slice(0, 60),
        sw: cell.scrollWidth,
        cw: cell.clientWidth,
        cls: cell.className,
        ws: cs.whiteSpace,
        ov: cs.overflow,
        h: Math.round(cell.getBoundingClientRect().height),
      })
    }
    if (bad.length >= 5) break
  }
  return {
    ok: true,
    cols: ths.map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim()),
    thW: ths.map((th) => Math.round(th.getBoundingClientRect().width)),
    docColIndex: idx,
    bad,
  }
})
console.log(JSON.stringify(r, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detail-expand-20261123/round-06.png' })
await task.finish({ keep: [] })
