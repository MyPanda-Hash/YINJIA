#!/usr/bin/env node
/**
 * 只读探针:服务器 8090 响应时延采样(每 5s 打一次轻查询,连打 2 分钟),
 * 用来抓「手机端报工后前端卡住」是不是后端周期性卡顿(锁/事务)导致的。
 * 用法: node tools/archive/_diag-scan-report/_probe-server-latency.mjs [baseUrl] [分钟]
 * 只 login + POST 查询接口,不写任何数据。
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const MINUTES = Number(process.argv[3] || 2)
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
  signal: AbortSignal.timeout(15000),
})
const token = (await lr.json())?.data?.token
if (!token) { console.log('login failed'); process.exit(1) }

const call = async (path, body) => {
  const t0 = Date.now()
  try {
    const r = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(120000),
    })
    const t = await r.text()
    return `${Date.now() - t0}ms/${r.status}/${t.length}b`
  } catch (e) { return `ERR ${Date.now() - t0}ms ${e.message}` }
}

const end = Date.now() + MINUTES * 60000
let worst = 0
while (Date.now() < end) {
  const ts = new Date().toTimeString().slice(0, 8)
  const a = await call('/api/px/workOrderList', {})
  const b = await call('/api/px/scheduleBoard/scheduled', {})
  const c = await call('/api/px/scheduleBoard/linesSummary', {})
  const nums = [a, b, c].map((s) => Number((s.match(/^(\d+)ms/) || [])[1] || 0))
  worst = Math.max(worst, ...nums)
  console.log(`${ts} wo=${a} sched=${b} lines=${c}${Math.max(...nums) > 2000 ? '  <== 慢' : ''}`)
  await new Promise((r) => setTimeout(r, 5000))
}
console.log('worst =', worst, 'ms')
