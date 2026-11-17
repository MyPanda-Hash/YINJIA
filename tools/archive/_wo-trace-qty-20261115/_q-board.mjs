// _q-board.mjs — 只读取证:工单排产看板 4号车间 明细 + 日排产(需交付三桶)的当前口径。
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const LINE = process.argv[3] || '4号车间'
const SCOPE = process.argv[4] || '未完工'

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
if (!token) { console.log('LOGIN FAIL ' + JSON.stringify(lg)); process.exit(1) }

const sched = await post('/api/px/scheduleBoard/scheduled', { 生产线: LINE, 页签: SCOPE }, token)
console.log('=== scheduled 行数 ' + (sched?.data || []).length + ' ===')
for (const r of sched?.data || []) {
  console.log(JSON.stringify({
    工单号: r['加工单号'], 行id: r['行id'], 工单行号: r['工单行号'], 行来源: r['行来源'],
    当前工序: r['当前工序'], 当前工序计划量: r['当前工序计划量'], 本线排产数量: r['本线排产数量'],
    需求数量: r['需求数量'], 排产数量: r['排产数量'], 入库数量: r['入库数量'],
    未交量: r['未交量'], 余量: r['余量'], 当前工序完工量: r['当前工序完工量'],
  }))
}

const dp = await post('/api/px/scheduleBoard/dayPlan/data', { 生产线: LINE, 页签: SCOPE }, token)
console.log('\n=== dayPlan 日期列 ' + JSON.stringify(dp?.data?.['日期']) + ' ===')
for (const r of dp?.data?.['行'] || []) {
  console.log(JSON.stringify({
    行id: r['行id'], 工序: r['工序'], 需求数量: r['需求数量'], 排产数量: r['排产数量'],
    工序计划量: r['工序计划量'], 交期: r['交期'], 交期紧迫度: r['交期紧迫度'],
    '7天需交付': r['7天需交付'], '15天需交付': r['15天需交付'], '大于15天需交付': r['大于15天需交付'],
    '7天已排': r['7天已排'], '15天已排': r['15天已排'], '大于15天已排': r['大于15天已排'],
    计划合计: r['计划合计'], 完工合计: r['完工合计'],
  }))
}
