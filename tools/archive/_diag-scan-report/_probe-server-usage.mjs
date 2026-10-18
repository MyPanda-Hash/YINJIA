#!/usr/bin/env node
/**
 * 只读探针:服务器使用留痕最近 N 条(默认 page=1 size=100),重点看 结案/取消结案 与扫码后的动作。
 * 用法: node ... [baseUrl] [size]
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const SIZE = process.argv[3] || '100'
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
  signal: AbortSignal.timeout(15000),
})
const token = (await lr.json())?.data?.token
if (!token) { console.log('login failed'); process.exit(1) }
const r = await fetch(`${BASE}/api/sys/usageLog?page=1&size=${SIZE}`, {
  headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000),
})
const t = await r.text()
let j = null; try { j = JSON.parse(t) } catch {}
console.log(`usageLog HTTP ${r.status}`, j?.message ?? '')
const d = j?.data ?? {}
const rows = d.rows ?? d.list ?? d.records ?? (Array.isArray(d) ? d : [])
console.log('keys=', Object.keys(d).join(','), 'rows=', rows.length)
const cols = rows[0] ? Object.keys(rows[0]) : []
console.log('cols=', cols.join('|'))
for (const x of rows) console.log(cols.map((k) => String(x[k] ?? '')).join('\t'))
