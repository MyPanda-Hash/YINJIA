// 报工记录:产品编码/客户编码/产品规格 查询语义验证(8090 现役)
const API = 'http://127.0.0.1:8090/api'
async function post(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  const txt = await res.text()
  let json = null
  try { json = JSON.parse(txt) } catch (e) { /* ignore */ }
  return { status: res.status, json, txt }
}
const login = await post('/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = login.json?.data?.token
if (!token) { console.log('login FAIL'); process.exit(1) }

async function q(label, condition, keyword) {
  const r = await post('/px/queryFormDataList', { panelCode: 'WO_REPORT_LIST', keyword: keyword || '', condition: condition || {}, pageNo: 1, pageSize: 3 }, token)
  const d = r.json?.data || {}
  const rows = d.list || []
  console.log(`[${label}] status=${r.status} rows=${rows.length} total=${d.total ?? '?'}` +
    (rows.length ? ' 首行=' + JSON.stringify({ 产品编码: rows[0]['产品编码'], 产品规格: rows[0]['产品规格'], 客户编码: rows[0]['客户编码'] }) : ''))
  return rows.length
}
await q('产品编码精确 B-46-07', { 产品编码: 'B-46-07' })
await q('产品编码前缀 B-46', { 产品编码: 'B-46' })
await q('客户编码精确 A-48', { 客户编码: 'A-48' })
await q('客户编码前缀 A-4', { 客户编码: 'A-4' })
await q('产品规格精确 60*45*231', { 产品规格: '60*45*231' })
await q('产品规格模糊 60*45', { 产品规格: '60*45' })
await q('产品编码+客户编码组合', { 产品编码: 'B-46-07', 客户编码: 'A-48' })
await q('keyword=产品编码片段 B-46', {}, 'B-46')
