// 验证 2026-10-30 三项改动(只读接口;不改库)
//   ① 工序路线排线「实际开工」只认真报工(GD-2026-10-0229 一条报工都没有 ⇒ 应全是「-」)
//   ② 日排产日期列不再出现「今天以前且当天无报工」的空列
//   ③ 排线保存不再自动铺日计划(本脚本只读;靠代码删除 + 编译 + 接口无新格验证)
// 用法(仓库根): node tools/archive/_verify-actual-start-20261030/verify.mjs [http://127.0.0.1:8090]
const base = process.argv[2] || 'http://127.0.0.1:8090'

async function api(path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const r = await fetch(base + path, {
    method: 'POST', headers, body: JSON.stringify(body ?? {}),
  })
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`)
  return r.json()
}

const login = await api('/api/auth/login', { userName: 'admin', password: '123456' })
const token = login.data.token
console.log(`login ok = ${!!token}`)

const dash = (v) => (v ? v : '-')

console.log('\n=== ① routeSteps:GD-2026-10-0229(工单 10-30 建、无任何报工)===')
const r = await api('/api/px/scheduleBoard/routeSteps', { 加工单号: 'GD-2026-10-0229', 行id: 2177 }, token)
for (const s of r.data['工序步骤']) {
  console.log(`  ${String(s['工序']).padEnd(4)} 计划 ${s['计划开工日期']} ~ ${s['计划完工日期']}` +
    `   实际开工=${dash(s['实际开工'])}  实际完工=${dash(s['实际完工'])}`)
}
console.log('  -- 已排台账 --')
for (const p of r.data['已排台账']) {
  console.log(`  ${String(p['工序']).padEnd(4)} 状态=${p['状态']}  实际开工=${dash(p['实际开工'])}`)
}

const showDates = (d, label) => {
  console.log(`  ${label}: 今天=${d['今天']}  日期列=[${(d['日期'] || []).join(',')}]  行数=${(d['行'] || []).length}`)
  for (const row of d['行'] || []) {
    const kv = (o) => Object.entries(o || {}).map(([k, v]) => `${k}=${v}`).join(' ') || '(空)'
    console.log(`    行id=${row['行id']} 工序=${row['工序'] || '-'} 交期=${row['交期'] || '-'} 日计划=${kv(row['日计划'])} 日报工=${kv(row['日报工'])}`)
  }
}

console.log('\n=== ② dayPlan/data:行id列表=[2177](10-30 新建工单,不应出现 10-20 之类空列)===')
showDates((await api('/api/px/scheduleBoard/dayPlan/data', { 行id列表: [2177] }, token)).data, '2177')

console.log('\n=== ②b dayPlan/data:行id列表=[1168](GD-2026-10-0223,10-20 有日计划+报工,历史列应保留)===')
showDates((await api('/api/px/scheduleBoard/dayPlan/data', { 行id列表: [1168] }, token)).data, '1168')

console.log('\n=== ②c dayPlan/data:产线模式(2号机,与 v3.73 同口径复核)===')
showDates((await api('/api/px/scheduleBoard/dayPlan/data', { 生产线: '2号机', scope: '未完工' }, token)).data, '2号机')
