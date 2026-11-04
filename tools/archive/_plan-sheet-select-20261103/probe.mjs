/**
 * probe.mjs —— 只读取证:planSheet 的行结构(2026-11-03)
 * 目的:确认每行都带 `行id`(勾选打印要按行id 过滤),且 scope/生产线 的取数口径未变。
 * 用法: node probe.mjs [base]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login?.data?.token
if (!token) { console.log('登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(1) }

async function plan(body) {
  const r = await (await fetch(BASE + '/api/px/scheduleBoard/planSheet', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  })).json()
  return r?.data || {}
}

const all = await plan({ scope: '未完工' })
const rows = all['行'] || []
console.log('scope=未完工 行数 =', rows.length, '日期列 =', (all['日期'] || []).length)
for (const r of rows) {
  console.log('  行id=' + r['行id'], '| 工单号=' + r['加工单号'], '| 行号=' + r['工单行号'],
    '| 线=' + r['生产线'], '| 客户=' + r['客户'], '| 排产=' + r['排产数量'])
}
const noId = rows.filter((r) => r['行id'] == null)
console.log('缺行id 的行数 =', noId.length)
