/**
 * _q-detail.mjs — 取 GD-2026-11-0032 的行 id + 工序步骤(换算率/计划量),判断 480 该不该换算。
 * 只读 8090(正式库)。
 */
const BASE = 'http://127.0.0.1:8090'
const post = async (p, b, t) => {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
    body: JSON.stringify(b),
  })
  const j = await r.json()
  return j
}
const lg = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = lg.data.token
const ps = (await post('/api/px/scheduleBoard/planSheet', { scope: '未完工', 生产线: '4号车间' }, token)).data || {}
const rows = ps['行'] || []
const row = rows.find((r) => String(r['加工单号']).includes('2026-11-0032'))
console.log('行id=' + row['行id'] + ' 当前工序=' + row['当前工序'] + ' 工艺路线=' + row['工艺路线'])
const det = await post('/api/px/processTask/detail',
  { 工单号: row['加工单号'], 工单行id: row['行id'] }, token)
const d = det.data || {}
console.log('=== detail 顶层键 ===')
console.log(Object.keys(d).join(', '))
const pick = ['排产数量', '订单数量', '需求数量', '计划合计', '工艺路线', '当前工序']
for (const k of pick) if (k in d) console.log(k + '=' + JSON.stringify(d[k]))
const steps = d['工序步骤'] || []
console.log('=== 工序步骤 ===')
for (const s of steps) {
  console.log(JSON.stringify({ 工序: s['工序'], 计划量: s['计划量'], 换算率: s['换算率'], 完工量: s['完工量'], 状态: s['状态'], 工序序: s['工序序'] }))
}
