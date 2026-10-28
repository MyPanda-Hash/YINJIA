// 通过现役接口复核:测试账套登录 → GET /api/dc/config → 统计已绑定网关
const BASE = process.env.DC_BASE || 'http://127.0.0.1:8090'
const r1 = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})
const j1 = await r1.json()
if (j1.code !== 200) { console.log('LOGIN FAIL', JSON.stringify(j1).slice(0, 300)); process.exit(1) }
const token = j1.data.token
const r2 = await fetch(BASE + '/api/dc/config', { headers: { Authorization: 'Bearer ' + token } })
const j2 = await r2.json()
if (j2.code !== 200) { console.log('CONFIG FAIL', JSON.stringify(j2).slice(0, 300)); process.exit(1) }
const d = j2.data
const devs = d.devices || []
const bound = devs.filter((x) => x.checks?.gateway).length
const gw = (d.gateways || []).map((g) => `${g.code}#${g.id} ${g.name} dev=${g.deviceCount ?? '-'}`)
console.log('数据库账套:', j1.data.user.factory)
console.log('设备总数:', devs.length, '已绑定网关:', bound, '未绑定:', devs.length - bound)
console.log('配置齐备:', devs.filter((x) => x.configured).length)
console.log('网关:', gw.join(' | ') || '(无)')
const s = d.summary || {}
console.log('汇总卡:', JSON.stringify(s.cards || s).slice(0, 400))
console.log('前 3 行:', devs.slice(0, 3).map((x) => `${x.code} gw=${x.gatewayName} progress=${x.progress}%`).join(' ; '))
