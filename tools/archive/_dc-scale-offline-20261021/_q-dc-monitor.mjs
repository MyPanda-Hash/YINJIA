/**
 * _q-dc-monitor.mjs —— 只读:数据监控 + 状态统计(判断是设备停了还是服务停了)
 * 用法:node _q-dc-monitor.mjs [base] [user] [pass] [YJ|YJ_TEST]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const U = process.argv[3] || 'admin'
const P = process.argv[4] || ''
const F = process.argv[5] || 'YJ'
const lr = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: U, password: P, factory: F }) })).json()
const token = lr?.data?.token
if (!token) { console.error('登录失败'); process.exit(1) }
const H = { Authorization: `Bearer ${token}` }
const j = async (p) => (await (await fetch(`${BASE}${p}`, { headers: H })).json().catch(() => ({})))
const m = await j('/api/dc/monitor?deviceId=1')
const d = m?.data || {}
console.log('serverTime =', d.serverTime)
console.log('device =', JSON.stringify(d.device || d.devices?.[0] || {}).slice(0, 300))
console.log('alarmOpen =', d.alarmOpen)
for (const p of (d.points || []).slice(0, 6)) console.log('  point:', JSON.stringify(p))
for (const a of (d.alarms || []).slice(0, 4)) console.log('  alarm:', JSON.stringify(a))
const s = await j('/api/dc/stats')
const sd = s?.data || {}
console.log('\nstats keys:', Object.keys(sd))
console.log('overall=', JSON.stringify(sd.overall || sd.summary || {}).slice(0, 300))
for (const row of (sd.devices || []).slice(0, 8)) console.log('  dev:', JSON.stringify(row).slice(0, 220))
const trend = sd.trend || sd.onlineTrend || []
if (trend.length) console.log('trend last3:', JSON.stringify(trend.slice(-3)))
