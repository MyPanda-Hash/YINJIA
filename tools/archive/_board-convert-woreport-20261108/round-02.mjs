// round-02.mjs — 有数据的产线(2号车间)验证冻结列 + 行内取值
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-board-freeze-20261108'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(4500)

const picked = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.wb-line')]
  const target = els.find((el) => (el.querySelector('.wb-line-name') || el).textContent.trim().startsWith('2号车间'))
  if (!target) return null
  target.click()
  return (target.querySelector('.wb-line-name') || target).textContent.trim()
})
console.log('picked line: ' + picked)
await page.waitForTimeout(5000)

const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.wb-block .el-table__body tbody tr')]
  const cellText = (tr, idx) => {
    const tds = tr.querySelectorAll('td')
    return tds[idx] ? (tds[idx].innerText || '').replace(/\s+/g, ' ').trim() : ''
  }
  // 冻结列按声明序:0 选择框、1 工单号、2 产品编码、3 产品规格、4 订单数量、5 客户
  const first = rows.slice(0, 5).map((tr) => ({
    工单号: cellText(tr, 1), 产品编码: cellText(tr, 2), 产品规格: cellText(tr, 3),
    订单数量: cellText(tr, 4), 客户: cellText(tr, 5), 工单行号: cellText(tr, 6),
    排产日期: cellText(tr, 7), 产品名称: cellText(tr, 9),
  }))
  const fixedCells = [...document.querySelectorAll('.wb-block .el-table__body td.el-table-fixed-column--left')]
  return { rowCount: rows.length, first, fixedCellCount: fixedCells.length }
})
console.log('rows: ' + JSON.stringify(info, null, 2))

// 横向滚动到一半,看冻结列 + 右侧滚动列共存
await page.evaluate(() => {
  const wraps = [...document.querySelectorAll('.wb-block .el-scrollbar__wrap')]
  const w = wraps.find((el) => el.scrollWidth > el.clientWidth + 10) || wraps[0]
  if (w) { w.scrollLeft = 900; w.dispatchEvent(new Event('scroll', { bubbles: true })) }
})
await page.waitForTimeout(1200)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-02-mid.png' })
console.log('done')
