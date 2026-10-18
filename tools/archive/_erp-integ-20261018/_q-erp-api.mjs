/**
 * _q-erp-api.mjs — 直接打接口核对 ERP 集成配置在「正式 / 测试」两个账套的返回(绕开 UI 工厂选择)。
 * 用法: node _q-erp-api.mjs [http://127.0.0.1:8090]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')

async function login(factory) {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  })
  const j = await r.json().catch(() => ({}))
  const d = j.data || j
  return { status: r.status, token: d.token || d.accessToken || (d.user && d.user.token), factory: d.user?.factory || d.factory, name: d.user?.userName || d.userName }
}

async function get(path, token) {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } })
  const t = await r.text()
  return { status: r.status, body: t }
}

for (const f of ['YJ', 'YJ_TEST']) {
  console.log('\n=== factory ' + f + ' ===')
  const l = await login(f)
  console.log('login', l.status, 'factory=' + l.factory, 'token=' + (l.token ? '(ok)' : '(none)'))
  if (!l.token) continue
  for (const p of ['/api/erp/integ/config', '/api/erp/integ/meta']) {
    const g = await get(p, l.token)
    let brief = g.body.slice(0, 160)
    try {
      const j = JSON.parse(g.body)
      const d = j.data || {}
      if (p.endsWith('config')) brief = JSON.stringify({ code: j.code, message: j.message, items: (d.items || []).length, stats: d.stats })
      else brief = JSON.stringify({ code: j.code, message: j.message, panels: (d.panels || []).length, devices: (d.devices || []).length })
    } catch (e) { /* keep raw */ }
    console.log(' ', p, g.status, brief)
  }
}
