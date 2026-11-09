// round-04 — 后端守卫验证(只读):直接用同一登录态 fetch
//   ① /pending 取一行 ② /routeSteps 拿工序链+上次产线 ③ /preplan 故意传「开工 11-09 / 完工 11-03」
//   期望 400 且消息含「计划开工日期不能晚于计划完工日期」。
//   即便守卫没触发,后面的「生产线不存在」也会先抛错,不会写库(两条路径都在 assign/写台账之前)。
const task = await taskSpace('plandate-guard-20261109')
const page = task.page('p1')
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const post = async (url, body) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {}),
    })
    let data = null
    try { data = await r.json() } catch (e) { data = { parseError: String(e) } }
    return { status: r.status, data }
  }
  const pending = await post('/api/px/scheduleBoard/pending', {})
  const list = pending.data?.data || pending.data || []
  const row = Array.isArray(list) ? list[0] : null
  if (!row) return { step: 'pending-empty', pending }
  const no = row['加工单号']
  const rid = row['行id']
  const rs = await post('/api/px/scheduleBoard/routeSteps', { 加工单号: no, 行id: rid })
  const d = rs.data?.data || {}
  const route = d['工序步骤'] || []
  const lastLines = d['上次产线'] || []
  const lineOf = (op) => (lastLines.find((x) => String(x['工序'] || '').trim() === String(op || '').trim()) || {})['上次生产线'] || ''
  const steps = route.map((s, i) => ({
    工序: s['工序'],
    生产线: i === 0 ? lineOf(s['工序']) : 'NOT-A-LINE-2026',
    计划开工日期: i === 0 ? '2026-11-09' : '2026-11-09',
    计划完工日期: i === 0 ? '2026-11-03' : '2026-11-09',
  }))
  const firstLine = steps[0] && steps[0]['生产线']
  if (!firstLine) return { step: 'no-valid-first-line', no, rid, route: route.map((s) => s['工序']), lastLines }
  const pre = await post('/api/px/scheduleBoard/preplan', { 加工单号: no, 行id: rid, 步骤: steps })
  return { step: 'done', no, rid, ops: route.map((s) => s['工序']), firstLine, preplanted: steps, resp: pre }
})
console.log(JSON.stringify(out, null, 2))
