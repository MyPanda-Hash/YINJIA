#!/usr/bin/env node
/**
 * 只读探针:服务器使用留痕按条件查(账号/面板/动作/日期),按时间倒序打印。
 * 用法: node ... [baseUrl] "[panelName]" "[actionName]" "[start]" "[end]" [size]
 *   例: node ... http://36.140.66.163:8090 "" "结案" "2026-10-18" "2026-10-19" 200
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const [panel = '', action = '', start = '', end = '', size = '200'] = process.argv.slice(3)
const qs = new URLSearchParams({ page: '1', size })
if (panel) qs.set('panelName', panel)
if (action) qs.set('actionName', action)
if (start) qs.set('start', start)
if (end) qs.set('end', end)
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
  signal: AbortSignal.timeout(15000),
})
const token = (await lr.json())?.data?.token
if (!token) { console.log('login failed'); process.exit(1) }
const r = await fetch(`${BASE}/api/sys/usageLog?` + qs.toString(), {
  headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000),
})
const j = await r.json().catch(() => null)
const d = j?.data ?? {}
const rows = d.rows ?? []
console.log(`HTTP ${r.status} total=${d.total} rows=${rows.length} 过滤=${qs.toString()}`)
for (const x of rows) {
  const at = String(x.createdAt ?? '')
  console.log([at.replace('T', ' ').slice(0, 19), x.userName, x.eventType, x.panelName, x.actionName, x.docNo].join('\t'))
}
