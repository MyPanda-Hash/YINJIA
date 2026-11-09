// 8091 + 测试账套 端到端验证「订单结转允许超订单数量(备品)」
// 流程:登录(YJ_TEST) → 查待结转行 → 取一行 剩余>0 且路线已审核 → 本次转单数量=剩余+50 提交转工单
// → 回读 plang 新行(xq_sl/pl_sl 应=超出后的数量) → 打印 RESULT_JSON(供 shell 侧回读/清理)
const API = 'http://127.0.0.1:8091/api'
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

const login = await post('/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })
console.log('login: ' + login.status + ' ' + JSON.stringify(login.json && { code: login.json.code, msg: login.json.message }).slice(0, 200))
const token = login.json?.data?.token
if (!token) { console.log('NO TOKEN: ' + login.txt.slice(0, 400)); process.exit(1) }

const pending = await post('/px/orderConvert/pending', { keyword: '', dateFrom: '2026-09-01', dateTo: '2026-12-31' }, token)
const arr = Array.isArray(pending.json?.data) ? pending.json.data : []
console.log('pending: status=' + pending.status + ' rows=' + arr.length)
if (!arr.length) { console.log('pending raw: ' + pending.txt.slice(0, 400)); process.exit(1) }
// 前端 applyRouteDefaults 的预填优先级:上次(已审核) > 同品名同规格(已审核) > 档案绑定;这里按同口径取路线
const routeOf = (r) => {
  if (r['工艺路线'] && r['路线审核状态'] === '已审核') return r['工艺路线']
  if (r['上次工艺路线'] && r['上次路线审核状态'] === '已审核') return r['上次工艺路线']
  if (r['同品名同规格上次工艺路线'] && r['同品名同规格上次审核状态'] === '已审核') return r['同品名同规格上次工艺路线']
  return ''
}
const row = arr.find((r) => Number(r['剩余数量']) > 0 && routeOf(r))
if (!row) {
  console.log('no usable row; sample=' + JSON.stringify(arr[0]).slice(0, 600))
  process.exit(1)
}
const remain = Number(row['剩余数量'])
const sendQty = remain + 50
console.log('picked row: ' + JSON.stringify({
  订单号: row['订单号'], 行id: row['行id'], 物料编码: row['物料编码'], 需求数量: row['需求数量'],
  已排产数量: row['已排产数量'], 剩余数量: remain, 工艺路线: routeOf(row), 转单数量: sendQty,
}, null, 2))

const toManu = await post('/px/orderConvert/toManu', {
  rows: [{ 订单号: row['订单号'], 行id: row['行id'], 生单数量: sendQty, 工艺路线: routeOf(row), 交货日期: row['交货日期'] }],
}, token)
console.log('toManu: status=' + toManu.status + ' body=' + JSON.stringify(toManu.json && (toManu.json.data || toManu.json)).slice(0, 700))
const created = toManu.json?.data?.['编号清单'] || []
console.log('RESULT_JSON=' + JSON.stringify({
  订单号: row['订单号'], 行id: row['行id'], 剩余数量: remain, 本次转单数量: sendQty, created,
}))
