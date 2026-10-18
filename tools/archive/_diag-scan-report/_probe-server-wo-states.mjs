#!/usr/bin/env node
/**
 * 只读探针:服务器生产工单列表的**状态分布**(结案/生产状态/当前工序),用来判断
 * 「扫码后其余工单变结案」到底是不是库里的状态。用法:node ... [baseUrl]
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'
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
    signal: AbortSignal.timeout(120000),
  })
  const t = await r.text()
  let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, ms: Date.now() - t0, json: j, text: t }
}

const t0 = Date.now()
const r = await api('/api/px/workOrderList', {})
console.log(`workOrderList HTTP ${r.status} ${Date.now() - t0}ms rows=${(r.json?.data ?? []).length}`)
const rows = r.json?.data ?? []
const tally = (key) => rows.reduce((m, x) => { const k = String(x[key] ?? '(空)'); m[k] = (m[k] || 0) + 1; return m }, {})
for (const k of ['结案', '生产状态', '完工状态', '当前工序']) {
  console.log(k, JSON.stringify(tally(k)))
}
const closed = rows.filter((x) => x.结案 === 'Y')
console.log('结案=Y 的行:', closed.length)
for (const x of closed.slice(0, 20)) console.log(' ', x.工单号, '#' + x.工单行号, x.生产状态, '当前工序=' + (x.当前工序 || ''), '完工状态=' + (x.完工状态 || ''))
