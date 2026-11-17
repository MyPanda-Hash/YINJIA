// round-17(修订口径·接口层):同一订单不同行两次转单应并进同一工单号;同一订单行重复转单才取新号
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/?r=' + Date.now() + '#/prod/plan/orderConvert', { timeout: 30000 })
await page.waitForTimeout(6000)
const res = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const post = async (path, body) => {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })
    return { status: r.status, body: await r.json() }
  }
  const one = async (lineId, qty) => post('/api/px/orderConvert/toManu', {
    rows: [{ 订单号: 'ZL-20261016-01', 行id: String(lineId), 生单数量: qty, 工艺路线: 'GY-CB-STD' }],
  })
  const out = {}
  out['①第2行(与第1行同订单,不同次)'] = await one(8771, 4509)
  await new Promise((r) => setTimeout(r, 800))
  out['②第3行(同订单,又一次)'] = await one(8772, 10080)
  await new Promise((r) => setTimeout(r, 800))
  out['③第1行再转一次(同一订单行,备品10)'] = await one(8770, 10)
  return out
})
console.log(JSON.stringify(res, null, 2))
