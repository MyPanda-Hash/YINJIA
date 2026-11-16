// _q-board-all.mjs — 遍历全部产线,把「同一工单号多行」在排产看板上怎么显示 未交量 打出来
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const post = async (p, b, t) => (await fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
  body: JSON.stringify(b),
})).json()

const lg = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const t = lg.data.token
const lines = (await post('/api/px/scheduleBoard/linesSummary', {}, t)).data || []
const names = lines.map((x) => x['生产线']).filter(Boolean)
console.log('产线数 ' + names.length)

const rows = []
for (const L of names) {
  const r = await post('/api/px/scheduleBoard/scheduled', { 生产线: L, 页签: '未完工' }, t)
  for (const x of r.data || []) rows.push({ 线: L, ...x })
}
console.log('未完工行数 ' + rows.length)

const byNo = new Map()
for (const x of rows) {
  const k = String(x['加工单号'])
  if (!byNo.has(k)) byNo.set(k, [])
  byNo.get(k).push(x)
}
console.log('\n=== 同一工单号出现多行的 ===')
for (const [k, arr] of byNo) {
  if (arr.length < 2) continue
  console.log('\n' + k + ' 出现 ' + arr.length + ' 行:')
  for (const x of arr) {
    console.log('   线=' + x['线'] + ' 行号=' + x['工单行号'] + ' 来源=' + x['行来源'] + ' 工序=' + x['当前工序']
      + ' 工序计划=' + x['当前工序计划量'] + ' 排产=' + x['排产数量'] + ' 入库=' + x['入库数量'] + ' 未交量=' + x['未交量'])
  }
  const sumUn = arr.reduce((a, x) => a + Number(x['未交量'] || 0), 0)
  const sumPl = arr.reduce((a, x) => a + Number(x['排产数量'] || 0), 0)
  console.log('   Σ未交量=' + sumUn + '  Σ排产=' + sumPl + '  (若按整单只应算一份)')
}

