// 报工记录(WO_REPORT_LIST)新字段后端查询验证:打 8090(现役) queryFormDataList
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
console.log('login: ' + login.status + ' token=' + (token ? 'ok' : 'FAIL'))
if (!token) { console.log(login.txt.slice(0, 300)); process.exit(1) }

async function q(label, condition, keyword) {
  const r = await post('/px/queryFormDataList', { panelCode: 'WO_REPORT_LIST', keyword: keyword || '', condition: condition || {}, pageNo: 1, pageSize: 5 }, token)
  const d = r.json?.data || {}
  const rows = d.list || d.rows || []
  console.log(`\n[${label}] status=${r.status} total=${d.total ?? '?'} rows=${rows.length}`)
  if (rows.length) {
    const k = rows[0]
    console.log('  首行: ' + JSON.stringify({ 单据编号: k['单据编号'], 工单号: k['工单号'], 产品编码: k['产品编码'], 产品规格: k['产品规格'], 报工数量: k['报工数量'] }))
  } else if (r.status !== 200) {
    console.log('  body=' + r.txt.slice(0, 300))
  }
  return rows
}

// 0) 不带条件:看新字段是否出现在返回行里
await q('无条件', {}, '')
// 1) 按产品编码(参照字段,condition 传编码)
await q('产品编码=S011', { 产品编码: 'S011' })
// 2) 按产品规格(文本,预期 LIKE 模糊)
await q('产品规格=34*16*180', { 产品规格: '34*16*180' })
// 3) 按客户编码
await q('客户编码=KF-001?', { 客户编码: 'KF-001' })
// 先查一下客户编码实际取值,再重试
const any = await post('/px/queryFormDataList', { panelCode: 'WO_REPORT_LIST', keyword: '', condition: {}, pageNo: 1, pageSize: 3 }, token)
console.log('\nraw sample keys: ' + JSON.stringify(Object.keys(any.json?.data?.list?.[0] || {})))
