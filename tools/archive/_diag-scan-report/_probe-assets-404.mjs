#!/usr/bin/env node
/**
 * 只读探针:检查服务器上「当前前端产物是否自洽」——把入口 chunk 里引用的所有 /assets/*.js|css
 * 逐个 GET,列出 404 的(有 404 = 该路由/该页面的动态 import 会失败,页面就一直转圈加载不出来)。
 * 用法: node tools/archive/_diag-scan-report/_probe-assets-404.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const seen = new Map()
const queue = []

const grab = (text) => {
  // Vite 产物的动态 import 是相对名(./WorkOrderList-xxxx.js),入口引用是 /assets/xxx.js —— 两种都收
  for (const m of text.matchAll(/["'`](?:\.\/|\/assets\/)([A-Za-z0-9_.-]+\.(?:js|css))["'`]/g)) {
    const p = '/assets/' + m[1]
    if (!seen.has(p)) { seen.set(p, null); queue.push(p) }
  }
}

const home = await fetch(BASE + '/', { signal: AbortSignal.timeout(20000) }).then((r) => r.text())
grab(home)
let n = 0
while (queue.length && n < 400) {
  const p = queue.shift()
  n++
  try {
    const r = await fetch(BASE + p, { signal: AbortSignal.timeout(30000) })
    const body = r.status === 200 ? await r.text() : ''
    seen.set(p, r.status)
    if (r.status === 200 && p.endsWith('.js')) grab(body)
    if (r.status !== 200) console.log(`!! ${r.status} ${p}`)
  } catch (e) {
    seen.set(p, 'ERR')
    console.log(`!! ERR ${p} ${e.message}`)
  }
}
const bad = [...seen.entries()].filter(([, s]) => s !== 200)
console.log(`检查 ${seen.size} 个产物,异常 ${bad.length} 个`)
if (bad.length) for (const [p, s] of bad.slice(0, 30)) console.log('  ', s, p)
