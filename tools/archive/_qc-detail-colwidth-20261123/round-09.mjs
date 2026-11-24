// round-09: 滚到「产品名称/规格型号/批次号」这三列,截图给用户看(红框里的列)
const task = await taskSpace('qc-detail-expand-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 30000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
const pos = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const wrap = table.querySelector('.el-scrollbar__wrap')
  const th = [...table.querySelectorAll('.el-table__header-wrapper thead th')].find((t) => (t.innerText || '').includes('产品名称'))
  wrap.scrollLeft = Math.max(0, th.offsetLeft - 260)
  const r = th.getBoundingClientRect()
  return { scrollLeft: wrap.scrollLeft, left: Math.round(r.left), w: Math.round(r.width) }
})
await page.waitForTimeout(600)
console.log(JSON.stringify(pos))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detail-expand-20261123/round-09-product-cols.png' })
await task.finish({ keep: [] })
