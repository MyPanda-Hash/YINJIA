// round-12:生产工单列表按工单号搜 GD-2026-11-0002/0004,确认「一个工单号多行 + 订单号/订单行号」
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.goto('http://localhost:5173/?r=' + Date.now() + '#/prod/plan/workOrderList?keyword=GD-2026-11-000', { timeout: 30000 })
await page.waitForTimeout(7000)
const info = await page.evaluate(() => ({
  hash: location.hash,
  keyword: [...document.querySelectorAll('input')].map((i) => i.value).filter((v) => v && v.includes('GD-')),
  headers: [...document.querySelectorAll('.el-table__header th')].map((t) => (t.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  rows: [...document.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())),
}))
console.log(JSON.stringify(info, null, 2).slice(0, 12000))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-12-workorderlist.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
