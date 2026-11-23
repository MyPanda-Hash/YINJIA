/**
 * 探针:打 8091(新后端)的 /api/px/qcFlow/list,核对「检验数据记录」字段与「两单都审完才离开检验」口径。
 * 用法: node _scratch/_qc4/probe-api.mjs [base]
 */
const base = process.argv[2] || 'http://127.0.0.1:8091'

const login = await fetch(base + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
}).then((r) => r.json())
if (!login?.data?.token) {
  console.error('登录失败', JSON.stringify(login).slice(0, 300))
  process.exit(1)
}
const res = await fetch(base + '/api/px/qcFlow/list', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token },
  body: JSON.stringify({ 状态: '全部', limit: 800, 含已隐藏: true }),
}).then((r) => r.json())
const data = res?.data || {}
const rows = data['行'] || []
console.log('汇总 =', JSON.stringify(data['汇总']))
console.log('行数 =', rows.length)
const has = (r, k) => Object.prototype.hasOwnProperty.call(r, k)
console.log('字段齐全 =', ['检验数据记录单号', '检验数据记录日期', '检验数据记录状态', '检验数据记录结论']
  .map((k) => `${k}:${has(rows[0] || {}, k)}`).join(' '))
let withRec = 0
let bothApproved = 0
let stuck = 0
for (const r of rows) {
  const rec = String(r['检验数据记录单号'] || '').trim()
  if (rec) withRec++
  const need = Number(r['需检验'] || 0) === 1
  if (need && r['检验状态'] === '已审核' && r['检验数据记录状态'] === '已审核') bothApproved++
  if (need && r['检验状态'] === '已审核' && (!rec || r['检验数据记录状态'] !== '已审核') && r['当前环节'] === '检验') stuck++
}
console.log(`有记录 = ${withRec} / 两单都已审 = ${bothApproved} / 检验单已审但记录缺→停在检验 = ${stuck}`)
for (const r of rows.filter((x) => String(x['检验数据记录单号'] || '').trim()).slice(0, 6)) {
  console.log(' ', r['送料暂收单号'], r['物料编码'], '| 检验', r['检验单号'], r['检验状态'],
    '| 记录', r['检验数据记录单号'], r['检验数据记录状态'], r['检验数据记录日期'],
    '| 入库', r['入库单号'] || '-', r['入库状态'] || '-', '| 环节', r['当前环节'])
}
