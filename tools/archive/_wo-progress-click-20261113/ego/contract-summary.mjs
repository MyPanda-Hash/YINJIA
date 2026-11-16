// contract-summary.mjs — 只读：统计接口里 工序步骤 的 生产线/台账状态/已排产 覆盖度（作为验收证据）
const task = await taskSpace('wo-progress-click-20261113')
const page = (await task.pages())[0] ?? (await task.newPage())
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForSelector('.wpb-grid-row', { timeout: 30000 })
const res = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/workOrderProgress/list', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ 状态: '未完工', limit: 300 }),
  })
  const j = await r.json()
  const rows = j?.data?.['行'] || []
  let steps = 0, withLine = 0, withLedger = 0, schedTrue = 0, differedLine = 0
  const diffSamples = []
  for (const row of rows) {
    for (const s of (row['工序步骤'] || [])) {
      steps++
      if (String(s['生产线'] || '') !== '') withLine++
      if (String(s['台账状态'] || '') !== '') withLedger++
      if (s['已排产'] === true) schedTrue++
      if (String(s['生产线'] || '') && String(s['生产线']) !== String(row['生产线'] || '')) {
        differedLine++
        if (diffSamples.length < 5) diffSamples.push({ no: row['工单号'], rowLine: row['生产线'], op: s['工序'], stepLine: s['生产线'], ledger: s['台账状态'] })
      }
    }
  }
  return { status: r.status, 数据时间: j?.data?.['数据时间'], rows: rows.length, steps, withLine, withLedger, schedTrue, differedLine, diffSamples }
})
console.log(JSON.stringify(res, null, 2))
