// _verify-api.mjs — 首件检验单「按天出单」验证:登录 → 吸收 → 选生产工单接口
// 用法: node _verify-api.mjs <baseUrl> <step>
//   step = absorb | wolines | fromwoline | all
const base = process.argv[2] || 'http://127.0.0.1:8090'
const step = process.argv[3] || 'all'
const WO = 'GD-TEST-FIRST-261112'

async function login() {
  const r = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const j = await r.json()
  const token = j?.data?.token
  if (!token) throw new Error('login failed: ' + JSON.stringify(j).slice(0, 300))
  return token
}
const call = async (token, path, opts = {}) => {
  const r = await fetch(base + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) },
  })
  const text = await r.text()
  try { return { status: r.status, body: JSON.parse(text) } } catch { return { status: r.status, body: text.slice(0, 500) } }
}

const token = await login()
console.log('LOGIN ok')

if (step === 'absorb' || step === 'all') {
  const res = await call(token, '/api/px/scheduleBoard/absorbMobile', { method: 'POST', body: JSON.stringify({ days: 2 }) })
  const d = res.body?.data || {}
  console.log('ABSORB status=' + res.status,
    'candidates=' + d['候选行'], 'done=' + d['已吸收'], 'skip=' + d['跳过'], 'fail=' + d['失败'])
  for (const one of (d['明细'] || []).filter((x) => String(x['工单号'] || '') === WO || String(x['原因'] || '').includes('TEST-FIRST'))) {
    console.log('  ROW ' + JSON.stringify(one))
  }
  const tm = (d['明细'] || []).filter((x) => JSON.stringify(x).includes(WO))
  for (const one of tm) console.log('  FIXTURE ROW ' + JSON.stringify(one))
}
if (step === 'wolines' || step === 'all') {
  const res = await call(token, '/api/qc/firstInsp/woLines?keyword=' + encodeURIComponent(WO) + '&pageNo=1&pageSize=20')
  const d = res.body?.data || {}
  const list = d.list || []
  const hit = list.filter((r) => String(r['工单号']) === WO)
  console.log('WOLINES status=' + res.status, 'total=' + d.totalSize, 'hit=' + hit.length,
    'hitRows=' + JSON.stringify(hit.map((r) => ({ 工单号: r['工单号'], 行号: r['工单行号'], 生产状态: r['生产状态'], 可开单: r['可开单'] }))))
}
if (step === 'fromwoline' || step === 'all') {
  const res = await call(token, '/api/qc/firstInsp/fromWoLine', { method: 'POST', body: JSON.stringify({ 工单号: WO, 工单行号: 1 }) })
  console.log('FROMWOLINE status=' + res.status, 'body=' + JSON.stringify(res.body).slice(0, 400))
}
