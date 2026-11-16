// _q-before.mjs — 只读取证:8090(现役老 jar)追溯「完工数据」段当前返回什么(修复前的基线)。
// 用途:与修后(8091)对照,证明「计划数量」从成品口径 → 工序口径的变化。
const BASE = process.argv[2] || 'http://127.0.0.1:8090'

async function post(path, body, token) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  })
  return r.json()
}

const lg = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = lg?.data?.token
if (!token) { console.log('LOGIN FAIL:', JSON.stringify(lg)); process.exit(1) }

const cases = [
  { 工单号: 'GD-2026-11-0028-1', 工单行id: 3210 },
  { 工单号: 'GD-2026-11-0028', 工单行id: 3209 },
  { 工单号: 'GD-2026-11-0017' },
  { 工单号: 'GD-2026-09-0009' },
]
for (const c of cases) {
  const r = await post('/api/px/scheduleBoard/trace', c, token)
  const d = r?.data
  console.log('\n=== ' + JSON.stringify(c) + ' ===')
  if (!d) { console.log('FAIL: ' + JSON.stringify(r).slice(0, 400)); continue }
  console.log('口径=' + d['头']?.['追溯口径'] + ' 排产数量=' + d['头']?.['排产数量'])
  console.log(JSON.stringify((d['完工数据'] || []).map((x) => ({
    工序: x['工序'], 计划数量: x['计划数量'], 换算率: x['换算率'], 完成数量: x['完成数量'], 单据状态: x['单据状态'],
  }))))
}
