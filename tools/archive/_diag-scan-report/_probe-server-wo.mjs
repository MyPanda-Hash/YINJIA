#!/usr/bin/env node
/**
 * 只读探针:从开发机看**服务器** 8090 上的生产工单列表状态(不经 RDP)。
 *   node tools/archive/_diag-scan-report/_probe-server-wo.mjs [baseUrl]
 * 只 login(签发 token)+ 查询,绝不写数据。
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'

const login = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
  signal: AbortSignal.timeout(20000),
})
const lj = await login.json().catch(() => null)
const token = lj?.data?.token
console.log(`login HTTP ${login.status} token=${token ? token.length + '字符' : '未签发'}`, lj?.message ?? '')
if (!token) process.exit(1)

const api = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(60000),
  })
  const t = await r.text()
  let j = null; try { j = JSON.parse(t) } catch { /* ignore */ }
  return { status: r.status, json: j, text: t }
}

const t0 = Date.now()
const r = await api('/api/px/workOrderList', {})
console.log(`workOrderList HTTP ${r.status} 用时 ${Date.now() - t0}ms`)
if (!r.json) { console.log(r.text.slice(0, 500)); process.exit(1) }
const rows = r.json.data ?? []
console.log(`行数=${rows.length}`)
const head = ['工单号', '工单行号', '批次号', '生产线', '当前工序', '当前工序完工量', '排产数量', '入库数量', '完工状态', '结案', '生产状态']
console.log(head.join('\t'))
for (const x of rows) console.log(head.map((k) => String(x[k] ?? '')).join('\t'))
