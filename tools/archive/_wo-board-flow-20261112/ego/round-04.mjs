// 2026-11-12 round-04：工单排产看板冒烟（同一接口新增 4 列 + 展开明细）
const task = await taskSpace('wo-board-flow-20261112')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

// 点左侧「1号车间」
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('1号车间'))
  if (el) { el.click(); return true }
  return false
})
await page.waitForTimeout(4500)
const info = await page.evaluate(() => ({
  clicked: true,
  headers: [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  rows: [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 3),
  hasFlow: document.querySelectorAll('.wb-flow-tbl').length,
}))
console.log('clicked=' + clicked)
console.log('headers=' + JSON.stringify(info.headers))
console.log('rows=' + JSON.stringify(info.rows))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-flow-20261112/round-04-board.png' })
