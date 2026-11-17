// 2026-11-13 第二轮：手工新增（无订单数量）+ 工单删除（订单结转来源释放回订单结转 / 已排产有报工拒绝）验收探针
// 目标 = 8091 新 jar（指向测试账套 HSDZ_MES_TEST）；用法: node .../api-verify.mjs [baseUrl]
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const results = []
const ok = (name, cond, detail) => { results.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`) }
async function call(method, path, body, token) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) })
  const txt = await res.text()
  let json
  try { json = JSON.parse(txt) } catch { throw new Error(`${path} HTTP ${res.status} 非 JSON: ${txt.slice(0, 300)}`) }
  return { http: res.status, code: json.code, message: json.message, data: json.data }
}
const post = (p, b, t) => call('POST', p, b, t)

const login = (await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })).data
const token = login.token
if (!token) throw new Error('登录失败')
console.log('login OK, base=' + BASE)
const options = (await post('/api/px/workOrderList/options', {}, token)).data
const route = options['默认工艺路线']
const customer = (options['客户'] || []).find((c) => String(c['客户编码'] || '').trim() !== '') || {}

// ── ① 手工新增:只发生产数量(不再发订单数量) ──
const created = (await post('/api/px/workOrderList/create', {
  工单类型: '常规', 产品编码: 'A-32-01', 客户编码: customer['客户编码'] || '',
  生产数量: 33, 工单日期: new Date().toISOString().slice(0, 10), 工艺路线: route,
  备注: '验收探针-删除-手工',
}, token)).data || {}
const plNo = created['工单号'] || ''
ok('① 手工新增(只传生产数量,不传订单数量)成功', String(plNo).startsWith('GD-'), `工单号=${plNo}`)
const list1 = (await post('/api/px/workOrderList', { keyword: plNo }, token)).data || []
const row1 = list1.find((r) => r['工单号'] === plNo)
ok('① 需求数量 = 生产数量(后端兜底,不为 0)', !!row1 && Number(row1['需求数量']) === 33 && Number(row1['排产数量']) === 33,
  row1 ? `需求=${row1['需求数量']} 排产=${row1['排产数量']}` : '未查到')
// 删手工单
const del1 = await post('/api/px/workOrderList/delete', { 行id: created['行id'] }, token)
ok('① 手工工单删除成功', del1.code === 200 && String(del1.data?.['提示'] || '').includes('手工新增'), `code=${del1.code} 提示=${del1.data?.['提示']}`)
const listAfter = (await post('/api/px/workOrderList', { keyword: plNo }, token)).data || []
ok('① 删除后列表查不到', !listAfter.some((r) => r['工单号'] === plNo))
const delAgain = await post('/api/px/workOrderList/delete', { 行id: created['行id'] }, token)
ok('① 重复删除被拒(不存在/已删除)', delAgain.code !== 200, `code=${delAgain.code} message=${delAgain.message}`)

// ── ② 订单结转来源工单删除 → 订单行释放回订单结转 ──
const ORDER_NO = 'ZXL-20261016-03'
const LINE_KEY = 'ZXL-20261016-03#8765'   // 测试账套现有订单行 id(bl_so_order.id=8765)
const ROW_ID = 84                        // GD-2026-10-0016#3,该订单行的已转工单行(未排产/无报工/无入库)
const pendingBefore = (await post('/api/px/orderConvert/pending', { keyword: ORDER_NO, dateFrom: '2026-01-01', dateTo: '2026-12-31' }, token)).data || []
const keysBefore = pendingBefore.map((r) => `${r['订单号']}#${r['行id']}`)
ok('② 删除前:该订单行不在订单结转(已被工单占用)', !keysBefore.includes(LINE_KEY), `待结转行=${JSON.stringify(keysBefore).slice(0, 200)}`)
const del2 = await post('/api/px/workOrderList/delete', { 行id: ROW_ID }, token)
ok('② 订单结转来源工单删除成功且释放占用', del2.code === 200 && del2.data?.['是否释放订单占用'] === true,
  `code=${del2.code} 提示=${del2.data?.['提示']}`)
const pendingAfter = (await post('/api/px/orderConvert/pending', { keyword: ORDER_NO, dateFrom: '2026-01-01', dateTo: '2026-12-31' }, token)).data || []
const hitAfter = pendingAfter.find((r) => `${r['订单号']}#${r['行id']}` === LINE_KEY)
ok('② 删除后:订单行回到订单结转且剩余>0', !!hitAfter && Number(hitAfter['剩余数量']) > 0,
  hitAfter ? `订单行=${hitAfter['订单号']}#${hitAfter['行id']} 剩余=${hitAfter['剩余数量']}` : '未回到订单结转')
const del2Again = await post('/api/px/workOrderList/delete', { 行id: ROW_ID }, token)
ok('② 已删除工单不能再删', del2Again.code !== 200, `code=${del2Again.code} message=${del2Again.message}`)

// ── ③ 已排产(且有报工)工单拒绝删除 ──
const delSched = await post('/api/px/workOrderList/delete', { 行id: 91 }, token)
ok('③ 已排产/有报工工单被拒', delSched.code !== 200 && String(delSched.message || '').includes('已排产'),
  `code=${delSched.code} message=${delSched.message}`)

// ── ④ 权限矩阵含 del 且已授权 ──
const r = await fetch(BASE + '/api/sys/role/2/panels', { headers: { Authorization: 'Bearer ' + token } })
const data = (await r.json()).data || {}
let def = null
let granted = null
for (const list of Object.values(data)) {
  if (!Array.isArray(list)) continue
  for (const p of list) {
    if (p.panelCode !== 'WORK_ORDER_LIST') continue
    if (Array.isArray(p.actions)) def = p
    if (typeof p.perms === 'string') granted = p
  }
}
const hasDelAction = !!def && def.actions.some((a) => a[0] === 'del')
const hasDelPerm = !!granted && String(granted.perms).split(',').includes('del')
ok('④ 权限矩阵含 del(删除)动作且角色已授权', hasDelAction && hasDelPerm,
  `动作=${hasDelAction} 授权=${hasDelPerm} perms=${granted ? granted.perms : ''}`)

const failed = results.filter((x) => !x.pass)
console.log(`\n== 汇总 ${results.length - failed.length}/${results.length} PASS ==`)
console.log(JSON.stringify({ 手工工单: plNo, 删除订单结转工单行id: ROW_ID, 恢复说明: '测试账套: id=84 已软删+占用已释放(见 README 恢复 SQL)' }, null, 1))
process.exit(failed.length ? 1 : 0)
