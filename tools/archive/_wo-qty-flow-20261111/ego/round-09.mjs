// 2026-11-11 工序按量流转:第 9 轮 —— 工单排产列表(WorkOrderList)与工单排产看板(WorkOrderBoard)真机复核
const task = await taskSpace('wo-qty-flow-20261111')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

// ① 列表页
await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await page.waitForTimeout(5000)
const list = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/workOrderList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ keyword: 'GD-QTY-TEST-11' }),
  })
  const j = await r.json().catch(() => null)
  const rows = Array.isArray(j?.data) ? j.data.filter((x) => x['工单号'] === 'GD-QTY-TEST-11') : []
  return {
    status: r.status,
    rows: rows.map((x) => ({
      工单号: x['工单号'], 当前工序: x['当前工序'], 当前工序完工量: x['当前工序完工量'],
      当前工序计划量: x['当前工序计划量'], 生产状态: x['生产状态'],
    })),
    pageText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
  }
})
console.log('列表接口: ' + JSON.stringify(list, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-09-a-workorderList.png' })

// ② 工单排产看板(选中 1号机)
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(5000)
const board = await page.evaluate(() => ({
  line: [...document.querySelectorAll('.wb-line-name')].map((e) => (e.textContent || '').trim()).slice(0, 6),
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log('看板页: ' + JSON.stringify(board, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-09-b-workorderBoard.png' })
