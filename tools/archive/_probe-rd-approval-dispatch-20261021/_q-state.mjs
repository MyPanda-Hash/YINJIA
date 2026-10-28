/**
 * _q-state.mjs —— 立项申请「定级分发」按钮门禁复现(只读 API,不改数据)
 * 用法:node _q-state.mjs <base> <docNo> [YJ|YJ_TEST]
 * 打印 /px/rdFlow/state 的等级/对接人 + 四个 can* 标志。
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const DOC = process.argv[3] || ''
const FACTORY = process.argv[4] || 'YJ'
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
const token = login?.data?.token
if (!token) { console.error('登录失败', JSON.stringify(login).slice(0, 300)); process.exit(1) }
const st = await fetch(`${BASE}/api/px/rdFlow/state?docNo=${encodeURIComponent(DOC)}`,
  { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
console.log(`[${FACTORY}] docNo=${DOC}`)
console.log(JSON.stringify(st?.data ?? st, null, 2))
