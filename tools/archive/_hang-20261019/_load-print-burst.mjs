#!/usr/bin/env node
/**
 * 「打印工单 → 整个系统卡住」可复现负载脚本(2026-10-19)
 *
 * 复刻前端 WorkOrderList.doPrintTask 的真实请求形状:
 *   勾选 N 行 → `await Promise.all(src.map(r => POST /api/px/processTask/detail))`
 *   —— **无并发上限**,勾 100 行就是 100 个请求同时打到后端(Hikari 池 maximum-pool-size=10)。
 *
 * 同时每 300ms 打一次 /api/px/workOrderList(模拟"别人还在用系统"),记录延迟曲线。
 * 判据:若 burst 期间列表接口延迟飙升(>2s)或出现 5xx/连接超时 ⇒ 池被打印的并发请求占满,
 *       表现就是"打印一下,所有人都卡住"。
 *
 * 用法: node _load-print-burst.mjs [N] [--base http://127.0.0.1:8090]
 */
const BASE = (() => { const i = process.argv.indexOf('--base'); return i > 0 ? process.argv[i + 1] : 'http://127.0.0.1:8090' })()
const N = Number(process.argv[2] || 60)

const post = async (path, body, token, timeoutMs = 60000) => {
  const t0 = Date.now()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body ?? {}),
      signal: ac.signal,
    })
    const text = await r.text()
    return { status: r.status, ms: Date.now() - t0, body: text }
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, body: e.name === 'AbortError' ? 'TIMEOUT' : e.message }
  } finally { clearTimeout(timer) }
}

const login = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = JSON.parse(login.body).data?.token
if (!token) { console.log('登录失败', login); process.exit(1) }
console.log('登录 OK,', login.ms, 'ms')

const list = await post('/api/px/workOrderList', {}, token)
const rows = JSON.parse(list.body).data || []
console.log(`列表 ${rows.length} 行,耗时 ${list.ms}ms`)

// 单次 detail 基线
const one = await post('/api/px/processTask/detail', { 工单号: rows[0]['工单号'], 工单行id: rows[0]['行id'] }, token)
console.log(`单次 detail 基线: ${one.ms}ms status=${one.status}`)

const pick = rows.slice(0, Math.min(N, rows.length))
console.log(`\n开始 burst:${pick.length} 个 detail 并发(打印勾选行时前端就是这么打的)\n`)

let stopped = false
const samples = []
const monitor = (async () => {
  while (!stopped) {
    const r = await post('/api/px/workOrderList', {}, token, 30000)
    samples.push(r.ms)
    console.log(`  [列表] ${String(r.ms).padStart(6)}ms status=${r.status}${r.ms > 2000 ? '   <== 卡' : ''}`)
    await new Promise((s) => setTimeout(s, 300))
  }
})()

const t0 = Date.now()
const burst = await Promise.all(pick.map((r) => post('/api/px/processTask/detail', { 工单号: r['工单号'], 工单行id: r['行id'] }, token)))
const burstMs = Date.now() - t0
stopped = true
await monitor

const ok = burst.filter((b) => b.status === 200).length
const bad = burst.filter((b) => b.status !== 200)
const slow = burst.filter((b) => b.ms > 3000).length
console.log('\n===== 结论 =====')
console.log(`burst 完成 ${burst.length} 个请求,总耗时 ${burstMs}ms`)
console.log(`  200=${ok}  非200=${bad.length}  >3s=${slow}  最慢=${Math.max(...burst.map((b) => b.ms))}ms`)
if (bad.length) console.log('  失败样例:', bad.slice(0, 3))
console.log(`列表监控 ${samples.length} 次:最慢 ${Math.max(...samples)}ms,>2s 次数 ${samples.filter((s) => s > 2000).length}`)
