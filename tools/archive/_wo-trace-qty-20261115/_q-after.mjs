// _q-after.mjs — 修复后(8091 并行实例)追溯「完工数据」段自检 + 与 8090(修复前)并列对照。
const BASES = (process.argv[2] || 'http://127.0.0.1:8091,http://127.0.0.1:8090').split(',')

async function post(base, path, body, token) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  })
  return r.json()
}

const cases = [
  { 工单号: 'GD-2026-11-0028-1', 工单行id: 3210 },
  { 工单号: 'GD-2026-11-0028', 工单行id: 3209 },
  { 工单号: 'GD-2026-11-0017' },
  { 工单号: 'GD-2026-09-0009' },
  { 工单号: 'GD-2026-10-0226-1' },
]

for (const base of BASES) {
  let token = null
  try {
    const lg = await post(base, '/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
    token = lg?.data?.token
  } catch (e) { console.log(base + ' 不可达: ' + e.message); continue }
  if (!token) { console.log(base + ' 登录失败'); continue }
  console.log('\n########## ' + base + ' ##########')
  for (const c of cases) {
    const r = await post(base, '/api/px/scheduleBoard/trace', c, token)
    const d = r?.data
    console.log('\n=== ' + JSON.stringify(c) + ' ===')
    if (!d) { console.log('FAIL ' + JSON.stringify(r).slice(0, 300)); continue }
    console.log('口径=' + d['头']?.['追溯口径'] + ' 头.排产数量=' + d['头']?.['排产数量'])
    console.log(JSON.stringify((d['完工数据'] || []).map((x) => ({
      工序: x['工序'], 换算率: x['换算率'], 计划数量: x['计划数量'], 完成数量: x['完成数量'],
      待审数量: x['待审数量'], 单据状态: x['单据状态'], 报工人: x['报工人'], 报工时间: x['报工时间'],
    }))))
    // 工序进度(折成品)自检
    const p = await post(base, '/api/px/processTask/detail', c, token)
    const pd = p?.data
    if (pd) console.log('工序进度: 计划合计=' + pd['计划合计'] + ' 产出=' + pd['产出'] + ' 产出工序口径=' + pd['产出工序口径'] + ' 进度=' + pd['表头']?.['进度'])
  }
}
