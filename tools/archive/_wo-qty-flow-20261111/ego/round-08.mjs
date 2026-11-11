// 2026-11-11 工序按量流转:第 8 轮 —— 列表/看板口径复核(当前工序 = 最前未完工道 = 成型)
const task = await taskSpace('wo-qty-flow-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_REPORT', { timeout: 30000 })
await page.waitForTimeout(2500)

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const post = async (url, body) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    })
    return { status: r.status, json: await r.json().catch(() => null) }
  }
  const list = await post('/api/px/workOrderList/list', { keyword: 'GD-QTY-TEST-11', 状态: '' })
  const rows = (list.json?.data?.rows || list.json?.data || []).filter?.((r) => r['工单号'] === 'GD-QTY-TEST-11') || []
  const board = await post('/api/px/scheduleBoard/scheduled', { 生产线: '1号机', scope: '未完工' })
  const bRows = (board.json?.data || []).filter((r) => r['加工单号'] === 'GD-QTY-TEST-11')
  return {
    listStatus: list.status,
    listRows: rows.map((r) => ({
      工单号: r['工单号'], 当前工序: r['当前工序'], 当前工序完工量: r['当前工序完工量'],
      当前工序计划量: r['当前工序计划量'], 生产状态: r['生产状态'], 排产数量: r['排产数量'],
    })),
    boardStatus: board.status,
    boardRows: bRows.map((r) => ({
      加工单号: r['加工单号'], 当前工序: r['当前工序'], 当前工序完工量: r['当前工序完工量'],
      当前工序计划量: r['当前工序计划量'], 生产状态: r['生产状态'], 生产线: r['生产线'], 上道工序: r['上道工序'], 上道完工量: r['上道完工量'],
    })),
  }
})
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-08-api-check.png' })
