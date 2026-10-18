/**
 * 期初导入后 —— 活体验证(通过 8090 接口查测试库,确认界面能正常读到)
 */
const BASE = 'http://127.0.0.1:8090'
const FACTORY = process.argv[2] || 'TEST'

const post = async (path, body, token) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  })
  return r.json()
}

const login = await post('/api/auth/login', { userName: 'admin', password: 'admin123', factory: FACTORY })
if (login.code !== 200 && login.code !== 0) {
  console.log('登录失败:', login.code, login.message)
  process.exit(1)
}
const token = login.data.token
console.log(`登录成功 · 账套 = ${login.data.user?.factory ?? FACTORY}`)

const panels = ['STOCK_STATUS', 'STOCK_SUMMARY', 'STOCK_LEDGER']
for (const p of panels) {
  const r = await post('/api/panel/queryFormDataList', { panelCode: p, pageNo: 1, pageSize: 3, queryParam: {} }, token)
  const d = r.data || {}
  const total = d.totalSize ?? d.total ?? '?'
  const first = (d.rows || d.list || d.data || [])[0]
  console.log(`  ${p.padEnd(14)} code=${r.code} total=${total}` + (first ? `  首行键=${Object.keys(first).slice(0, 8).join('/')}` : ''))
  if (r.code !== 200 && r.code !== 0) console.log('     ↳', r.message)
}
