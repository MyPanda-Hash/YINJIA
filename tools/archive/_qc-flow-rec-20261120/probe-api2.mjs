const base = process.argv[2] || 'http://127.0.0.1:8091'
const login = await fetch(base + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
const token = login?.data?.token
console.log('login ok =', !!token)
for (const body of [{ 状态: '未完成', limit: 800 }, { 状态: '未完成', limit: 800, 仅需检验: true }, { 状态: '全部', limit: 800 }]) {
  const res = await fetch(base + '/api/px/qcFlow/list', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  }).then((r) => r.json())
  console.log(JSON.stringify(body), '->', res.code, 'rows=', (res.data?.['行'] || []).length, 'summary=', JSON.stringify(res.data?.['汇总']))
}
