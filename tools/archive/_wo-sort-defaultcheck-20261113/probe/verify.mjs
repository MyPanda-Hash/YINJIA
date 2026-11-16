// 2026-11-13 排序/转单时间(A+B)验收探针(8091 新 jar，测试账套 HSDZ_MES_TEST)
// 用法: node tools/archive/_wo-sort-defaultcheck-20261113/probe/verify.mjs [baseUrl]
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const results = []
const ok = (name, cond, detail) => { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`) }
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body ?? {}) })
  const txt = await res.text(); let json; try { json = JSON.parse(txt) } catch { throw new Error(path + ' HTTP ' + res.status + ' 非JSON: ' + txt.slice(0, 200)) }
  if (!res.ok) throw new Error(path + ' HTTP ' + res.status + ': ' + JSON.stringify(json).slice(0, 300))
  return json.data ?? json
}
const login = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = login.token
const options = await post('/api/px/workOrderList/options', {}, token)
const route = options['默认工艺路线']
const today = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })()
console.log('route=' + route + ' today=' + today)

// ① 连续建两张(同一天) —— A 要求后建的排上面
const a = await post('/api/px/workOrderList/create', { 工单类型: '常规', 产品编码: 'A-32-01', 生产数量: 3, 工单日期: today, 工艺路线: route, 备注: '验收-排序旧' }, token)
await new Promise((r) => setTimeout(r, 1200))
const b = await post('/api/px/workOrderList/create', { 工单类型: '常规', 产品编码: 'A-32-01', 生产数量: 4, 工单日期: today, 工艺路线: route, 备注: '验收-排序新' }, token)
console.log('created:', a['工单号'], '→', b['工单号'])

// ② 列表顺序：按「工单日期 DESC, id DESC」⇒ 后建的 b 应在 a 之前(同一天)
const list = await post('/api/px/workOrderList', {}, token)
const rows = Array.isArray(list) ? list : []
const ia = rows.findIndex((r) => r['工单号'] === a['工单号'])
const ib = rows.findIndex((r) => r['工单号'] === b['工单号'])
ok('① 两张新单都在列表', ia >= 0 && ib >= 0, `a=${ia} b=${ib}`)
ok('① 后建的新单排在前(同日 id DESC)', ib >= 0 && ia >= 0 && ib < ia, `新单 idx=${ib} < 旧单 idx=${ia}`)
ok('① 新单在列表最顶部附近(前 5 行)', ib >= 0 && ib < 5, `idx=${ib}`)

// ③ 转单时间按北京时间显示(与浏览器本地时间差 < 10 分钟)
const rb = rows[ib] || {}
const shown = String(rb['转单时间'] || '')
const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(shown)
let diffMin = null
if (m) diffMin = Math.abs(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() - Date.now()) / 60000
ok('② 转单时间已按北京时间显示', diffMin !== null && diffMin < 10, `显示=${shown} 与当前本地时间差=${diffMin === null ? '解析失败' : diffMin.toFixed(1)}分钟`)

// ④ 工单日期(单据日期)仍是用户选的日期(不被时刻影响)
ok('③ 单据日期=所选工单日期', String(rb['单据日期'] || '') === today, `单据日期=${rb['单据日期']}`)

// ⑤ 手工建单允许只填生产数量(不再要求订单数量) —— 需求数量应等于生产数量
ok('④ 需求数量=生产数量(未填订单数量兜底)', Number(rb['需求数量']) === 4 && Number(rb['排产数量']) === 4,
  `需求=${rb['需求数量']} 排产=${rb['排产数量']}`)

const failed = results.filter((r) => !r.pass)
console.log(`\n== 汇总 ${results.length - failed.length}/${results.length} PASS ==`)
console.log(JSON.stringify({ 旧: a['工单号'], 新: b['工单号'], 行id_旧: a['行id'], 行id_新: b['行id'] }, null, 1))
process.exit(failed.length ? 1 : 0)
