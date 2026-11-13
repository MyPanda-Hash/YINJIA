// 只读：验证 8090（正式库）列表排序 + 转单时间显示；不建任何单据
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body ?? {}) })
  const j = await res.json()
  if (!res.ok) throw new Error(path + ' ' + res.status + ' ' + JSON.stringify(j).slice(0, 200))
  return j.data ?? j
}
const login = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = login.token
const list = await post('/api/px/workOrderList', {}, token)
const rows = Array.isArray(list) ? list : []
console.log('rows=' + rows.length)
for (const r of rows.slice(0, 8)) console.log(`${r['工单号']} | 行${r['工单行号']} | 单据日期=${r['单据日期']} | 转单时间=${r['转单时间']} | 物料=${r['物料编码']} | 类型=${r['工单类型']}`)
const today = rows.filter((r) => r['单据日期'] === '2026-11-13').map((r) => r['工单号'])
console.log('今日(11-13)行顺序=' + JSON.stringify(today))
const now = new Date()
const shown = String(rows[0]?.['转单时间'] || '')
const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(shown)
const diff = m ? Math.abs(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() - now.getTime()) / 60000 : null
console.log('首行转单时间与当前本地时间差(分钟)=' + (diff === null ? 'n/a' : diff.toFixed(1)))
process.exit(0)
