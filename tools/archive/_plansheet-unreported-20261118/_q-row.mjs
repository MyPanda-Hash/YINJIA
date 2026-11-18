/**
 * _q-row.mjs — 取 GD-2026-11-0032 在 planSheet 响应里的口径字段,判断「工序未报工量」该用哪一对。
 * 只读 8090(正式库)。
 */
const BASE = 'http://127.0.0.1:8090'
const post = async (p, b, t) => (await fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
  body: JSON.stringify(b),
})).json()
const lg = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = lg.data.token
const ps = (await post('/api/px/scheduleBoard/planSheet', { scope: '未完工', 生产线: '4号车间' }, token)).data || {}
const rows = ps['行'] || []
console.log('行数=' + rows.length)
for (const r of rows) {
  if (String(r['加工单号']).includes('2026-11-0032')) {
    const keys = ['行来源', '生产线', '当前工序', '当前工序序', '排产数量', '需求数量', '订单数量', '工序计划量',
      '本线排产数量', '当前工序计划量', '当前工序完工量', '上道工序', '上道完工量', '未交量', '生产状态']
    const o = {}
    for (const k of keys) o[k] = r[k]
    console.log(JSON.stringify(o, null, 2))
  }
}
