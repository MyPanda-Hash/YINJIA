#!/usr/bin/env node
/**
 * 只读探针:服务器 8090 的「工单排产看板」明细(/api/px/scheduleBoard/scheduled),
 * 也可看某条线的生产状态。用法:node ... [baseUrl] [生产线]
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const LINE = process.argv[3] || ''

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
  signal: AbortSignal.timeout(15000),
})
const token = (await lr.json())?.data?.token
if (!token) { console.log('login failed'); process.exit(1) }

const api = async (path, body) => {
  const t0 = Date.now()
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(90000),
  })
  const t = await r.text()
  let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, ms: Date.now() - t0, json: j, text: t }
}

const r = await api('/api/px/scheduleBoard/scheduled', { 生产线: LINE })
console.log(`scheduled(${LINE || '全部'}) HTTP ${r.status} ${r.ms}ms`)
if (!r.json) { console.log(r.text.slice(0, 400)); process.exit(0) }
const d = r.json.data
const rows = Array.isArray(d) ? d : (d?.rows ?? d?.明细 ?? [])
console.log('keys=', Array.isArray(d) ? 'array' : Object.keys(d || {}).join(','), 'rows=', rows.length)
for (const x of rows.slice(0, 40)) console.log(JSON.stringify(x))
