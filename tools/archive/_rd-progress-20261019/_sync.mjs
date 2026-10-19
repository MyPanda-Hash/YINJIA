/**
 * _sync.mjs — 触发 RD_PROGRESS「同步进度」(callButton) 并回读面板数据(会写库:导入明细)。
 * 用法: node tools/archive/_rd-progress-20261019/_sync.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'

const post = async (p, b, token) => (await (await fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(b || {}),
})).json())

const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
if (lg?.code !== 200) { console.log('登录失败', JSON.stringify(lg).slice(0, 200)); process.exit(1) }
const token = lg.data.token
console.log('== ' + BASE + ' 已登录 ==')

const r = await post('/px/callButton', { panelCode: 'RD_PROGRESS', buttonName: '同步进度', formData: {}, buttonParam: {} }, token)
console.log('callButton(同步进度) ->', JSON.stringify(r).slice(0, 400))

const q = await post('/px/queryFormDataList', { panelCode: 'RD_PROGRESS', condition: {}, pageNo: 1, pageSize: 10 }, token)
const d = q.data || {}
console.log(`\nRD_PROGRESS: code=${q.code} totalSize=${d.totalSize} list=${(d.list || []).length}`)
for (const row of (d.list || [])) {
  const key = Object.keys(row.detail || {})[0]
  const items = key ? (row.detail[key] || []) : []
  console.log(`  单据 ${row['单据编号'] || '-'} 明细(${key})=${items.length} 行`)
  for (const it of items.slice(0, 5)) console.log('    ', JSON.stringify(it).slice(0, 220))
}
