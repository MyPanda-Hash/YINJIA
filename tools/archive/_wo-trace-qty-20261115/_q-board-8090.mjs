// _q-board-8090.mjs — 对照:8090(现役)排产看板 4号车间/装箱2 的 未交量 与 需交付三桶
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const LINES = ['4号车间', '装箱2(新厂)']

const post = async (p, b, t) => (await fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
  body: JSON.stringify(b),
})).json()

const lg = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const t = lg.data.token

for (const L of LINES) {
  const r = await post('/api/px/scheduleBoard/scheduled', { 生产线: L, 页签: '未完工' }, t)
  console.log('#### ' + BASE + ' ' + L)
  for (const x of r.data || []) {
    console.log('  ' + JSON.stringify({
      单: x['加工单号'], 行: x['工单行号'], 来源: x['行来源'], 工序: x['当前工序'],
      工序计划: x['当前工序计划量'], 需求: x['需求数量'], 排产: x['排产数量'],
      入库: x['入库数量'], 未交量: x['未交量'], 余量: x['余量'],
    }))
  }
  const dp = await post('/api/px/scheduleBoard/dayPlan/data', { 生产线: L, 页签: '未完工' }, t)
  for (const x of (dp && dp.data && dp.data['行']) || []) {
    console.log('   dayPlan ' + JSON.stringify({
      行id: x['行id'], 工序: x['工序'], 需求: x['需求数量'], 排产: x['排产数量'], 工序计划量: x['工序计划量'],
      due7: x['7天需交付'], due15: x['15天需交付'], dueOver: x['大于15天需交付'],
      plan7: x['7天已排'], plan15: x['15天已排'], planOver: x['大于15天已排'],
    }))
  }
}
