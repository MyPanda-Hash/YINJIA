#!/usr/bin/env node
/**
 * 只读探针:今天「结案族」动作的**按动作/按分钟汇总**(谁在什么时候把工单结案了)。
 * 用法: node ... [baseUrl] [start] [end]
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const START = process.argv[3] || '2026-10-18'
const END = process.argv[4] || '2026-10-19'
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
  signal: AbortSignal.timeout(15000),
})
const token = (await lr.json())?.data?.token
if (!token) { console.log('login failed'); process.exit(1) }
const all = []
for (let page = 1; page <= 10; page++) {
  const qs = new URLSearchParams({ page: String(page), size: '200', start: START, end: END, actionName: '结案' })
  const r = await fetch(`${BASE}/api/sys/usageLog?` + qs, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000) })
  const d = (await r.json())?.data ?? {}
  all.push(...(d.rows ?? []))
  if (all.length >= (d.total ?? 0)) break
}
console.log('总条数=', all.length)
const byAction = {}
for (const x of all) byAction[x.actionName] = (byAction[x.actionName] || 0) + 1
console.log('按动作:', JSON.stringify(byAction))
// 按 分钟 聚合「结案」动作(排除取消结案)
const closes = all.filter((x) => x.actionName === '结案')
console.log('真正「结案」条数:', closes.length)
const byMin = {}
for (const x of closes) {
  const k = String(x.createdAt).replace('T', ' ').slice(0, 16)
  byMin[k] = (byMin[k] || 0) + 1
}
console.log('结案 按分钟:', JSON.stringify(byMin, null, 0))
const cancels = all.filter((x) => x.actionName === '取消结案')
const byMin2 = {}
for (const x of cancels) {
  const k = String(x.createdAt).replace('T', ' ').slice(0, 16)
  byMin2[k] = (byMin2[k] || 0) + 1
}
console.log('取消结案 按分钟:', JSON.stringify(byMin2))
console.log('\n最早的 10 条结案:')
for (const x of closes.slice(-10)) console.log([String(x.createdAt).replace('T', ' ').slice(0, 19), x.userName, x.panelName, x.actionName, x.docNo].join('\t'))
