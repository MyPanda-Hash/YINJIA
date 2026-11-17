// round-17:展开列表头/空态文案/已审核单在「本月」可见
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(4000)

const week = await page.evaluate(() => {
  const pane = [...document.querySelectorAll('.iss-tabs .el-tab-pane')][0]
  const th = [...(pane?.querySelectorAll('.el-table__header th') || [])][0]
  return {
    quick: [...document.querySelectorAll('.el-radio-button')].filter((n) => n.className.includes('is-active')).map((n) => n.textContent.trim())[0],
    firstHeader: (th?.textContent || '').replace(/\s+/g, ' ').trim(),
    firstHeaderW: th ? Math.round(th.getBoundingClientRect().width) : 0,
    empty: [...document.querySelectorAll('.iss-table .el-table__empty-text')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
    stats: [...document.querySelectorAll('.iss-stat b')].map((n) => n.textContent.trim()),
  }
})
console.log('WEEK', JSON.stringify(week))
await page.screenshot({ path: `${OUT}/17-week-empty.png` })

// 本月:已审核单应出现
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(2500)
const month = await page.evaluate(() => ({
  stats: [...document.querySelectorAll('.iss-stat')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  rows: [...document.querySelectorAll('.iss-tabs .el-tab-pane:nth-child(1) .el-table__body-wrapper tbody tr')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  firstHeader: [...document.querySelectorAll('.iss-tabs .el-tab-pane:nth-child(1) .el-table__header th')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 3),
}))
console.log('MONTH', JSON.stringify(month))
await page.evaluate(() => [...document.querySelectorAll('.iss-tabs .el-tabs__item')].find((n) => (n.textContent || '').includes('按委托单'))?.click())
await page.waitForTimeout(1200)
console.log('DOCS', JSON.stringify(await page.evaluate(() => ({
  headers: [...document.querySelectorAll('.iss-tabs .el-tab-pane:nth-child(2) .el-table__header th')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 4),
  row: [...document.querySelectorAll('.iss-tabs .el-tab-pane:nth-child(2) .el-table__body-wrapper tbody tr')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
}))))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/18-month-audited.png` })
await task.finish({ keep: [] })
