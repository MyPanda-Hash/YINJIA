/**
 * 只读核对:测试账套设备五连齐备情况(/api/dc/config)。
 * 用法: node _q-dc-ready.mjs [http://127.0.0.1:8090] [admin] [123456] [YJ_TEST]
 */
const [base = 'http://127.0.0.1:8090', user = 'admin', pass = '123456', factory = 'YJ_TEST'] =
  process.argv.slice(2)

async function req(p, o = {}) {
  const r = await fetch(base + p, o)
  const t = await r.text()
  try { return JSON.parse(t) } catch { throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`) }
}

const login = await req('/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: user, password: pass, factory }),
})
const token = login?.data?.token
if (!token) { console.log('登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(2) }
const cfg = (await req('/api/dc/config', { headers: { Authorization: 'Bearer ' + token } })).data || {}
console.log('kpis =', JSON.stringify(cfg.kpis))
const gw = cfg.gateways || []
console.log('gateways =', gw.length, gw.map((g) => `${g.code}(${g.status},设备${g.deviceCount ?? '-'})`).join(' '))
const devs = cfg.devices || []
const byType = {}
let bound = 0, ready = 0, withPoint = 0, withRule = 0, missing = 0
for (const d of devs) {
  byType[d.type] = (byType[d.type] || 0) + 1
  const c = d.checks || {}
  if (c.gateway) bound++
  if (d.configured) ready++
  if (Number(d.pointCount) > 0) withPoint++
  if (Number(d.ruleCount) > 0) withRule++
  if (!d.configured) missing++
}
console.log(`devices=${devs.length} 已绑定=${bound} 配置齐备=${ready} 未完成=${missing} 有采集点=${withPoint} 有规则=${withRule}`)
console.log('抽样首台 =', JSON.stringify({
  code: devs[0]?.code, gatewayName: devs[0]?.gatewayName, projectCode: devs[0]?.projectCode,
  scadaDrawn: devs[0]?.scadaDrawn, lastDebugAt: devs[0]?.lastDebugAt,
  pointCount: devs[0]?.pointCount, ruleCount: devs[0]?.ruleCount,
  configured: devs[0]?.configured, online: devs[0]?.online, checks: devs[0]?.checks,
}))
