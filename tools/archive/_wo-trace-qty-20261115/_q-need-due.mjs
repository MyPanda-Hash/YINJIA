// _q-need-due.mjs — 需交付三桶改「工序计划量」后的取证(8091 修复后 vs 8090 现役)
// 用法: node _q-need-due.mjs <base>
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const CASES = [
  { 生产线: '4号车间', 页签: '未完工' },          // GD-2026-11-0028(成型 换算率 0.5 → 需交付应为 25)
  { 生产线: '装箱2(新厂)', 页签: '未完工' },
  { 生产线: '1号车间', 页签: '未完工' },          // GD-2026-11-0012(成型 2500)
  { 生产线: '2号车间', 页签: '未完工' },
]

const post = async (p, b, t) => (await fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
  body: JSON.stringify(b),
})).json()

const lg = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const t = lg.data.token

let bad = 0
for (const c of CASES) {
  const dp = await post('/api/px/scheduleBoard/dayPlan/data', c, t)
  const rows = (dp && dp.data && dp.data['行']) || []
  console.log('\n=== ' + BASE + ' · ' + c.生产线 + ' ===')
  for (const r of rows) {
    const due = Number(r['7天需交付'] || 0) + Number(r['15天需交付'] || 0) + Number(r['大于15天需交付'] || 0)
    const cap = Number(r['工序计划量'] || 0)
    const ok = Math.abs(due - cap) < 0.001
    if (!ok) bad++
    console.log(`${ok ? '[PASS]' : '[FAIL]'} 行${r['行id']} 工序=${r['工序']} 需求数量=${r['需求数量']} 排产=${r['排产数量']}`
      + ` 工序计划量=${cap} ⇒ 需交付合计=${due}(7天=${r['7天需交付']} 15天=${r['15天需交付']} >15天=${r['大于15天需交付']})`
      + `  已排:7天=${r['7天已排']} 15天=${r['15天已排']}`)
  }
  const sc = await post('/api/px/scheduleBoard/scheduled', c, t)
  for (const x of sc.data || []) {
    const expect = Math.max(0, Number(x['排产数量'] || 0) - Number(x['入库数量'] || 0))
    const got = Number(x['未交量'] || 0)
    const ok = Math.abs(expect - got) < 0.001
    if (!ok) bad++
    console.log(`${ok ? '[PASS]' : '[FAIL]'} 未交量 ${x['加工单号']}#${x['工单行号']} = ${got}(排产 ${x['排产数量']} − 入库 ${x['入库数量']} = ${expect})`)
  }
}
console.log(bad === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${bad})`)
