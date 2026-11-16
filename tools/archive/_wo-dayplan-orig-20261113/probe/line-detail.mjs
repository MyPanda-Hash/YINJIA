// 2026-11-13:看指定产线的 日期列 / 各行计划区间 / 原计划 keys(排查"汇总有欠产但看不到红格")
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const LINE = process.argv[3] || '2号车间'
const SCOPE = process.argv[4] || '未完工'

async function post(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(path + ' ' + res.status + ' ' + JSON.stringify(json).slice(0, 200))
  return json.data ?? json
}
const login = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = login.token
const data = await post('/api/px/scheduleBoard/dayPlan/data', { 生产线: LINE, scope: SCOPE }, token)
console.log('今天=' + data['今天'] + ' 日期列=' + JSON.stringify(data['日期']))
for (const r of data['行'] || []) {
  console.log(JSON.stringify({
    行id: r['行id'], 工序: r['工序'], 工序计划量: r['工序计划量'],
    计划开工: r['计划开工日期'], 计划完工: r['计划完工日期'],
    原计划: r['原计划'], 日计划: r['日计划'], 日报工: r['日报工'],
  }))
}
