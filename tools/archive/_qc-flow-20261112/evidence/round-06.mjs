// round-06.mjs — 列表视图列宽收敛后的终验(管理员/正式账套):两视图各一张截图
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.evaluate(() => { location.hash = '#/qc/flowMonitor' })
await page.waitForTimeout(4000)
await page.reload()
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const board = await page.evaluate(() => ({
  hash: location.hash,
  board: !!document.querySelector('.qcf-board'),
  rows: document.querySelectorAll('.qcf-grid-row').length,
  stats: [...document.querySelectorAll('.qcf-stat')].map((s) => s.textContent.replace(/\s+/g, ' ').trim()),
}))
console.log('board =', JSON.stringify(board))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-06-board.png' })

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.qcf-view .el-radio-button__inner')].find((b) => (b.textContent || '').includes('列表'))
  if (btn) btn.click()
})
await page.waitForTimeout(1800)
const list = await page.evaluate(() => {
  const wrap = document.querySelector('.qcf-table .el-scrollbar__wrap')
  return {
    cols: [...document.querySelectorAll('.qcf-table th .cell')].map((c) => c.textContent.replace(/\s+/g, ' ').trim()),
    rows: document.querySelectorAll('.qcf-table .el-table__row').length,
    // 是否横向溢出:内容宽度 vs 容器宽度
    overflowX: wrap ? wrap.scrollWidth - wrap.clientWidth : null,
    bodyScrollX: document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
      ? document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap').scrollWidth
        - document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap').clientWidth : null,
  }
})
console.log('list =', JSON.stringify(list, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-06-list.png' })
console.log('done')
