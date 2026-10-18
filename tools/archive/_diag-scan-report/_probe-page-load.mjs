#!/usr/bin/env node
/**
 * 只读探针:模拟一次「浏览器刷新 MES 页面」——依次取 index.html、它引用的所有静态产物,
 * 再打登录 + 首屏几个接口,逐项打印耗时/状态。用来判断"转圈"是卡在静态资源还是接口。
 * 用法: node tools/archive/_diag-scan-report/_probe-page-load.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'

const t = async (label, url, opts = {}) => {
  const t0 = Date.now()
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000), ...opts })
    const body = await r.text()
    console.log(`${String(r.status).padEnd(4)} ${String(Date.now() - t0).padStart(6)}ms ${label} (${body.length}b)`)
    return { status: r.status, body, ms: Date.now() - t0 }
  } catch (e) {
    console.log(`ERR  ${String(Date.now() - t0).padStart(6)}ms ${label} ${e.message}`)
    return { status: 0, body: '', ms: Date.now() - t0 }
  }
}

const home = await t('index.html', BASE + '/')
const assets = [...new Set([...home.body.matchAll(/\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g)].map((m) => m[0]))]
console.log(`index.html 引用 ${assets.length} 个产物`)
for (const a of assets) await t(a, BASE + a)

// 登录 + 首屏接口
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }), signal: AbortSignal.timeout(20000),
})
const token = (await lr.json().catch(() => null))?.data?.token
console.log(`login HTTP ${lr.status} token=${token ? 'ok' : '无'}`)
if (token) {
  const api = (p, b) => t(p, BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify(b || {}),
  })
  for (const p of [
    '/api/portal', '/api/dashboard/capacity?period=day', '/api/px/workOrderList',
    '/api/px/scheduleBoard/pending', '/api/px/scheduleBoard/stats',
    '/api/px/scheduleBoard/linesSummary', '/api/px/scheduleBoard/scheduled',
    '/api/sys/usageLog?page=1&size=5',
  ]) {
    if (p.includes('?')) await t(p, BASE + p, { headers: { Authorization: 'Bearer ' + token } })
    else await api(p, {})
  }
}
