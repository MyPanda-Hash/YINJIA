#!/usr/bin/env node
/**
 * 只读探针:在服务器上，把某个**页面/组件**的懒加载 chunk 找出来并直接 GET 一次。
 * 用途:排查「点某页/刷新某页白屏」到底是 chunk 404(部署不完整)还是请求挂住(连接层)。
 * 用法: node tools/archive/_diag-scan-report/_probe-chunk.mjs [baseUrl] [关键字]
 *   例: node ... http://36.140.66.163:8090 WorkOrderBoard
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const KEY = process.argv[3] || 'WorkOrderBoard'

const home = await fetch(BASE + '/', { signal: AbortSignal.timeout(20000) }).then((r) => r.text())
const entry = (home.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0]
console.log('入口 chunk =', entry)
const entryBody = await fetch(BASE + entry, { signal: AbortSignal.timeout(30000) }).then((r) => r.text())
console.log('入口体积 =', entryBody.length, 'b')

const names = [...new Set([...entryBody.matchAll(/"(\.\/)?([A-Za-z0-9_-]+-[A-Za-z0-9_-]{6,}\.js)"/g)].map((m) => m[2]))]
const hits = names.filter((n) => n.toLowerCase().includes(KEY.toLowerCase()))
console.log(`入口里共 ${names.length} 个异步 chunk；名字含「${KEY}」的 ${hits.length} 个：`)
for (const h of hits) {
  const t0 = Date.now()
  const r = await fetch(BASE + '/assets/' + h, { signal: AbortSignal.timeout(30000) })
  console.log(`  ${String(r.status).padEnd(4)} ${String(Date.now() - t0).padStart(6)}ms ${h} ${r.status === 200 ? (await r.text()).length + 'b' : ''}`)
}
// 顺带把「所有异步 chunk」逐个 HEAD 一次，列出非 200 的
let bad = 0
for (const n of names) {
  const r = await fetch(BASE + '/assets/' + n, { method: 'HEAD', signal: AbortSignal.timeout(20000) })
  if (r.status !== 200) { bad++; console.log('  !!', r.status, n) }
}
console.log(`异步 chunk 全量检查:${names.length} 个,非 200 的 ${bad} 个`)
