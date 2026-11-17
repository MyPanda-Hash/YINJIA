// stranded-fix-verify：历史遗留「需求 100 / 已排 50」的行，重开排线弹窗按 50 保存 ⇒ 剩余 50 自动切单
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const post = async (path, body, token) => {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body ?? {}) })
  const j = await res.json()
  return { code: j.code, message: j.message, data: j.data }
}
const login = (await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })).data
const token = login.token
const list = (await post('/api/px/workOrderList', { keyword: 'GD-VERIFY-STRAND-01' }, token)).data || []
const row = list.find((r) => r['工单号'] === 'GD-VERIFY-STRAND-01')
console.log('fixture=' + JSON.stringify(row ? { 需求: row['需求数量'], 排产: row['排产数量'], 线: row['生产线'] } : null))
const rs = (await post('/api/px/scheduleBoard/routeSteps', { 加工单号: 'GD-VERIFY-STRAND-01', 行id: row['行id'] }, token)).data || {}
const lineOf = { 成型: '成型1线', 切炭: '切炭2(自动)', 组装: '组装线' }
const steps = (rs['工序步骤'] || []).map((s) => ({ 工序: s['工序'], 生产线: lineOf[s['工序']] }))
// 弹窗默认排产数量 = 当前排产 50(需求 100) ⇒ 直接保存
const pre = await post('/api/px/scheduleBoard/preplan', { 加工单号: 'GD-VERIFY-STRAND-01', 行id: row['行id'], 排产数量: 50, 步骤: steps }, token)
console.log('preplan=' + JSON.stringify({ code: pre.code, 排产: pre.data?.['排产数量'], 子单: pre.data?.['自动切出子工单'], 剩余: pre.data?.['自动切出数量'], 提示: pre.data?.['自动切单提示'] }))
const after = (await post('/api/px/workOrderList', { keyword: 'GD-VERIFY-STRAND-01' }, token)).data || []
const parent = after.find((r) => r['工单号'] === 'GD-VERIFY-STRAND-01')
const child = after.find((r) => r['工单号'] === pre.data?.['自动切出子工单'])
console.log('parent=' + JSON.stringify({ 需求: parent?.['需求数量'], 排产: parent?.['排产数量'], 线: parent?.['生产线'] }))
console.log('child=' + JSON.stringify({ 单: child?.['工单号'], 需求: child?.['需求数量'], 排产: child?.['排产数量'], 线: child?.['生产线'] }))
const ok = pre.code === 200 && Number(pre.data?.['自动切出数量']) === 50 && Number(parent?.['需求数量']) === 50
  && Number(parent?.['排产数量']) === 50 && Number(child?.['需求数量']) === 50 && !String(child?.['生产线'] || '').trim()
console.log('RESULT: ' + (ok ? 'PASS' : 'FAIL'))
process.exit(ok ? 0 : 1)
