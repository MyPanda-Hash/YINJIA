/** probe-schedule-trace.cjs —— 确认「工单追溯」段失败是既有问题还是本功能引入:直接调排产看板的 /scheduleBoard/trace */
const API = 'http://127.0.0.1:8090'
async function main() {
  const login = await (await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const T = login.data.token
  const r = await fetch(API + '/api/px/scheduleBoard/trace', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T}` },
    body: Buffer.from(JSON.stringify({ 工单号: 'GD-2026-10-0223', 工单行id: 1168 }), 'utf8'),
  })
  const j = await r.json().catch(() => null)
  console.log('GET /api/px/scheduleBoard/trace →', r.status, 'code=', j?.code)
  console.log((j?.message || '').slice(0, 500))
}
main().catch((e) => { console.error(e); process.exit(1) })
