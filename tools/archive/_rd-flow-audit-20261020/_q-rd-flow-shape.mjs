/**
 * 只读:核对 /api/px/rdFlow 出参形状(旧单据兜底字段 planCandidates 是否按预期出现)。
 * 用法: node _q-rd-flow-shape.mjs http://127.0.0.1:8090 admin 123456 [YJ|YJ_TEST]
 */
const [base = 'http://127.0.0.1:8090', user = 'admin', pass = '123456', factory = ''] = process.argv.slice(2)

async function req(p, o = {}) {
  const r = await fetch(base + p, o)
  const t = await r.text()
  try { return JSON.parse(t) } catch { throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`) }
}

const login = await req('/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: user, password: pass, ...(factory ? { factory } : {}) }),
})
const token = login?.data?.token
if (!token) { console.log('登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(2) }
const data = (await req('/api/px/rdFlow', { headers: { Authorization: 'Bearer ' + token } })).data || {}
for (const p of data.projects || []) {
  console.log(
    p.approvalNo,
    '| plans=' + (p.plans || []).length,
    '| planCandidates=' + (p.planCandidates ? JSON.stringify(p.planCandidates) : '(缺键)'),
    '| trail=' + (p.trail || []).length,
    '| progressRows=' + (p.progressRows || []).length,
  )
}
