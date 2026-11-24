// round-08: 真鼠标翻页 + 点表头排序,确认内容自适应列宽在翻页后仍 0 截断
const task = await taskSpace('qc-detail-expand-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 30000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

const measure = () => page.evaluate(() => {
  const table = document.querySelector('.report-table')
  if (!table) return { ok: false }
  const ths = [...table.querySelectorAll('.el-table__header-wrapper thead th')]
  const trs = [...table.querySelectorAll('.el-table__body-wrapper tbody tr')]
  let truncated = 0
  const widths = {}
  ths.forEach((th, i) => {
    const label = (th.innerText || '').replace(/\s+/g, ' ').trim().replace(' ⇅', '')
    widths[label] = Math.round(th.getBoundingClientRect().width)
    for (const tr of trs) {
      const cell = tr.querySelectorAll('td')[i]?.querySelector('.cell')
      if (!cell) continue
      if (cell.scrollWidth > cell.clientWidth + 1) truncated++
      if (cell.scrollHeight > cell.clientHeight + 1) truncated++
    }
  })
  const first = trs[0]?.querySelectorAll('td')[2]?.innerText || ''
  return { ok: true, rows: trs.length, truncated, firstDocNo: first, widths: { 单据编号: widths['单据编号'], 工单号: widths['工单号'], 产品名称: widths['产品名称'] } }
})

const p1 = await measure()

// 真鼠标点「下一页」
const nextBtn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-pagination button, .pager button, button')].find((x) => (x.getAttribute('aria-label') || x.title || '').includes('下一页') || (x.innerText || '').trim() === '›')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})
if (nextBtn) { await page.mouse.click(nextBtn.x, nextBtn.y); await page.waitForTimeout(2500) }
const p2 = await measure()

// 真鼠标点「单据编号」表头排序
const thBtn = await page.evaluate(() => {
  const th = [...document.querySelectorAll('.report-table .el-table__header-wrapper thead th')].find((t) => (t.innerText || '').includes('单据编号'))
  const s = th?.querySelector('.report-col-sorter')
  if (!s) return null
  const r = s.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})
if (thBtn) { await page.mouse.click(thBtn.x, thBtn.y); await page.waitForTimeout(1500) }
const p3 = await measure()

console.log(JSON.stringify({ p1, p2, p3, hasNextBtn: !!nextBtn, hasSorter: !!thBtn }, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detail-expand-20261123/round-08-sorted.png' })
await task.finish({ keep: [] })
