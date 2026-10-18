/**
 * _q-dash-vitals.mjs —— 桌面各模块当前"有没有货"体检(验收前自查,只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-dash-vitals.mjs [baseUrl]
 */
const B = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
const lg = JSON.parse(await (await fetch(B + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).text()).data.token
const get = async (p) => JSON.parse(await (await fetch(B + p, { headers: { Authorization: 'Bearer ' + lg } })).text()).data

const s = await get('/dashboard/stats')
const num = (v) => (typeof v === 'number' ? v : null)
const flag = (v) => (typeof v === 'number' ? (v > 0 ? '✅' : '❌0') : v ? '✅' : '❌空')
const rows = []
const push = (mod, name, v) => rows.push([mod, name, typeof v === 'number' ? String(v) : JSON.stringify(v).slice(0, 40), flag(v)])

console.log('== 概览 ==')
for (const [k, v] of Object.entries(s.kpis || {})) push('概览', k, v)
push('概览', '最新动态', (s.latest || []).length)
push('概览', '工单队列', (s.progress || []).length)
console.log('== 生产 ==')
push('生产', '工单状态分布', (s.production?.statusDist || []).reduce((a, b) => a + (b.value || 0), 0))
push('生产', '已完工', (s.production?.statusDist || []).find((x) => x.name === '已完工')?.value ?? 0)
push('生产', '车间分布', (s.production?.workshopDist || []).length)
push('生产', '五工序完成率', (s.production?.stageRates || []).length)
push('生产', '趋势点数', (s.production?.trend7 || []).length)
push('生产', '趋势合计', (s.production?.trend7 || []).reduce((a, b) => a + (b.added || 0) + (b.done || 0), 0))
console.log('== 库存 ==')
push('库存', '入库单数', s.stock?.totalIn)
push('库存', '出库单数', s.stock?.totalOut)
push('库存', '明细行', s.stock?.totalLines)
push('库存', '现存量TOP', (s.stock?.topItems || []).length)
push('库存', '趋势合计', (s.stock?.trend7 || []).reduce((a, b) => a + (b.added || 0) + (b.done || 0), 0))
console.log('== 销售 ==')
for (const [k, v] of Object.entries(s.sales || {})) if (typeof v === 'number') push('销售', k, v)
push('销售', '趋势合计', (s.sales?.trend7 || []).reduce((a, b) => a + (b.added || 0) + (b.done || 0), 0))
console.log('== 质量 ==')
for (const [k, v] of Object.entries(s.quality || {})) if (typeof v === 'number') push('质量', k, v)
push('质量', '结果分布', (s.quality?.byResult || []).length)
console.log('== 研发 ==')
for (const [k, v] of Object.entries(s.rd || {})) if (typeof v === 'number') push('研发', k, v)
console.log('== 产能(日) ==')
const cap = await get('/dashboard/capacity?period=day')
const capRows = cap.rows || []
push('生产', '产线条数', capRows.length)
push('生产', '有产出的线', capRows.filter((r) => Number(r.actual || 0) > 0).length)
push('生产', '有上限的线', capRows.filter((r) => Number(r.limit || 0) > 0).length)
console.log('\n模块\t指标\t值\t判定')
for (const r of rows) console.log(r.join('\t'))
const bad = rows.filter((r) => r[3].startsWith('❌'))
console.log(`\n空/零项 ${bad.length} 个:`)
for (const r of bad) console.log('  ' + r[0] + ' · ' + r[1] + ' = ' + r[2])
