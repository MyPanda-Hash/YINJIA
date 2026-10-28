/**
 * 只读:远端/本地某账套每台数采设备的五连缺项(部署或改配置前后核对用)。
 * 用法: node _q-dc-checks.mjs http://127.0.0.1:8090 admin 123456 [YJ|YJ_TEST]
 */
const [base = 'http://127.0.0.1:8090', user = 'admin', pass = '123456', factory = 'YJ'] =
  process.argv.slice(2)

async function req(p, { method = 'GET', body, token } = {}) {
  const r = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const t = await r.text()
  try { return JSON.parse(t) } catch { throw new Error(`HTTP ${r.status} ${t.slice(0, 160)}`) }
}

const login = await req('/api/auth/login', { method: 'POST', body: { userName: user, password: pass, factory } })
const token = login?.data?.token
if (!token) { console.log('登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(2) }
const cfg = (await req('/api/dc/config', { token })).data || {}
console.log(`[${factory}] ${base}`)
console.log('kpis =', JSON.stringify(cfg.kpis), '| gateways =', (cfg.gateways || []).length)
const mark = (b) => (b ? 'v' : 'X')
for (const d of cfg.devices || []) {
  const c = d.checks || {}
  console.log(
    `  ${d.code} (${d.type}) 网关${mark(c.gateway)} 工程${mark(c.project)} 组态${mark(c.scada)} 规则${mark(c.rule)} 调试${mark(c.debug)}` +
      ` | 采集点=${d.pointCount} 规则=${d.ruleCount} 齐备=${d.configured} 在线=${d.online}`,
  )
}
