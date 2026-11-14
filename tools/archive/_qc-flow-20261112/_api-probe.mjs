// _api-probe.mjs — 品质流程监控接口取数核对(只读):汇总 + 若干行 + 环节分布
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
}).then((r) => r.json())
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }

async function call(body) {
  const r = await fetch(`${BASE}/api/px/qcFlow/list`, { method: 'POST', headers: H, body: JSON.stringify(body) })
  return r.json()
}

for (const state of ['未完成', '已完成', '异常', '全部']) {
  const j = await call({ 状态: state, limit: 800 })
  const d = j.data || {}
  const rows = d['行'] || []
  const byStage = {}
  for (const r of rows) byStage[r['当前环节']] = (byStage[r['当前环节']] || 0) + 1
  console.log(`\n== 状态=${state} ==  汇总=`, JSON.stringify(d['汇总']), ' 环节分布=', JSON.stringify(byStage))
}

const j = await call({ 状态: '全部', limit: 800 })
const rows = j.data['行']
const pick = (n) => rows.filter((r) => r['当前环节'] === n).slice(0, 3)
for (const stage of ['送料', '检验', '入库', '完成']) {
  console.log(`\n---- 当前环节=${stage} 样例 ----`)
  for (const r of pick(stage)) {
    console.log([
      r['送料暂收单号'], r['送料状态'], '|', r['物料编码'], r['物料批号'], '|',
      '检验:', r['检验单号'] || '-', r['检验状态'] || '-', '|',
      '入库:', r['入库单号'] || '-', r['入库状态'] || '-', r['入库匹配方式'] || '', '|',
      '需检验=' + r['需检验'], '异常=' + r['异常'], '停留=' + r['停留天数'] + '天',
    ].join(' '))
  }
}
console.log('\n异常行样例:', JSON.stringify((rows.filter((r) => r['异常']).slice(0, 3)).map((r) => ({
  单: r['送料暂收单号'], 送料: r['送料状态'], 检验: r['检验状态'], 入库: r['入库单号'], 结论: r['检验结论'],
})), null, 1))
