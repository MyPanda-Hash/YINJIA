// 2026-11-13:8091 新 jar(含新前端)—— 接口侧「原计划 / 历史欠产」对账探针
// 用法: node .tmp/probe-verify/shortfalls.mjs [baseUrl]
const BASE = process.argv[2] || 'http://127.0.0.1:8091'

async function post(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  const txt = await res.text()
  let json
  try { json = JSON.parse(txt) } catch { throw new Error(`${path} HTTP ${res.status} 非 JSON: ${txt.slice(0, 300)}`) }
  if (!res.ok || (json.code !== undefined && json.code !== 200 && json.code !== 0)) {
    throw new Error(`${path} HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`)
  }
  return json.data ?? json
}

const login = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = login.token
if (!token) throw new Error('no token: ' + JSON.stringify(login).slice(0, 200))

const today = new Date().toISOString().slice(0, 10)
const lines = await post('/api/px/scheduleBoard/linesSummary', { 开工日期: today }, token)
console.log('lines=' + (lines || []).map((l) => l.生产线).join(','))

const out = []
for (const l of lines || []) {
  const line = l.生产线
  if (!line) continue
  const data = await post('/api/px/scheduleBoard/dayPlan/data', { 生产线: line, scope: '未完工' }, token)
  const day = data['今天']
  const sched = await post('/api/px/scheduleBoard/scheduled', { 生产线: line, scope: '未完工' }, token)
  const byId = new Map((sched || []).map((r) => [String(r.行id), r]))
  const items = []
  for (const row of data['行'] || []) {
    const base = row['原计划'] || {}
    const done = row['日报工'] || {}
    for (const d of Object.keys(base)) {
      if (d >= day) continue
      const p = Number(base[d] || 0)
      if (p <= 0) continue
      const a = Number(done[d] || 0)
      if (a >= p - 1e-6) continue
      const s = Math.round((p - a) * 10000) / 10000
      const sr = byId.get(String(row.行id)) || {}
      items.push({ 行id: row.行id, 单号: sr.加工单号 || sr.工单号 || '', 行号: sr.工单行号, date: d, plan: p, actual: a, short: s })
    }
  }
  out.push({
    line, rows: (data['行'] || []).length, dates: (data['日期'] || []).length, today: day,
  })
  // 补:GD-2026-11-0017 今天格的 原计划/日报工(截图核对用)
  for (const row of data['行'] || []) {
    const sr = byId.get(String(row.行id)) || {}
    if ((sr.加工单号 || '') === 'GD-2026-11-0017') {
      out[out.length - 1].gd0017 = {
        行id: row.行id, 工序: row.工序, 工序计划量: row.工序计划量,
        原计划: row['原计划'], 日计划: row['日计划'], 日报工: row['日报工'],
      }
    }
  }
  out[out.length - 1].shortCount = items.length
  out[out.length - 1].shortQty = Math.round(items.reduce((a, x) => a + x.short, 0) * 10000) / 10000
  if (items.length) out[out.length - 1].shortSample = items.slice(0, 6)
}

console.log(JSON.stringify(out, null, 1))
