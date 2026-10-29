/**
 * _q-dc-dev.mjs —— 只读:数采设备当前状态(在线判定依据 last_seen / 心跳规则)
 * 用法:node _q-dc-dev.mjs [base] [user] [pass] [YJ|YJ_TEST] [设备前缀]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const U = process.argv[3] || 'admin'
const P = process.argv[4] || ''
const F = process.argv[5] || 'YJ'
const PFX = process.argv[6] || ''
const lr = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: U, password: P, factory: F }) })).json()
const token = lr?.data?.token
if (!token) { console.error('登录失败', JSON.stringify(lr).slice(0, 200)); process.exit(1) }
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const cfg = await (await fetch(`${BASE}/api/dc/config`, { method: 'POST', headers: H, body: '{}' })).json().catch(() => ({}))
const g = await (await fetch(`${BASE}/api/dc/config`, { headers: H })).json().catch(() => ({}))
const data = cfg?.data || g?.data || {}
console.log('data keys:', Object.keys(data))
const devices = data.devices || data.deviceList || []
console.log('devices:', devices.length)
for (const d of devices) {
  const code = d.code || d.deviceCode || d['编码'] || ''
  if (PFX && !String(code).startsWith(PFX)) continue
  console.log(JSON.stringify(d))
}
