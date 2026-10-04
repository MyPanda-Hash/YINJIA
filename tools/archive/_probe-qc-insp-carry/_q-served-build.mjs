import fs from 'node:fs'

/**
 * 一次性排障:8090(正式实例,java -jar)下发的**打包版**前端 与 仓库源码/最新构建 的差异。
 * 用法:node tools/archive/_probe-qc-insp-carry/_q-served-build.mjs
 */
const fetched = await (await fetch('http://127.0.0.1:8090/')).text()
const assets = [...fetched.matchAll(/assets\/[^"']+\.js/g)].map((m) => m[0])
console.log('8090 首页引用 chunk:', assets.join(' , '))

for (const p of ['backend/src/main/resources/static/index.html', 'frontend/dist/index.html']) {
  if (!fs.existsSync(p)) { console.log(p, '-> (不存在)'); continue }
  const h = fs.readFileSync(p, 'utf8')
  console.log(p, '->', [...h.matchAll(/assets\/[^"']+\.js/g)].map((m) => m[0]).join(' , '))
}

const probes = ['带入检验要求', 'qr-carry-btn', 'qcInspReqCarry', 'detail.items', '暂无数据', 'qc_insp_req']
const idxJs = await (await fetch('http://127.0.0.1:8090' + assets[0])).text()
const all = [...new Set([...idxJs.matchAll(/assets\/[\w.\-]+\.js/g)].map((m) => m[0]))]
console.log(`\n首页 chunk 内引出 ${all.length} 个 chunk,逐个查关键字:`)
for (const p of all) {
  const js = await (await fetch('http://127.0.0.1:8090' + p)).text()
  const hits = probes.filter((k) => js.includes(k))
  console.log(`  ${p.padEnd(42)} ${String(js.length).padStart(8)}B  ${hits.join(', ') || '-'}`)
}
