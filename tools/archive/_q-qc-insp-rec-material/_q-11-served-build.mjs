/**
 * _q-11-served-build.mjs — 探针:8090 当前服务的前端产物是否已含「检验数据记录商品参照」
 * 判据:served index.html 引用的 PanelxList chunk 里是否出现本次改动的特征串 qr-ref-ctl / RefPickDialog 接线。
 */
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const KEYS = ['qr-ref-ctl', 'qr-ref-text', '点击选择']

const html = await (await fetch(`${BASE}/`)).text()
const entry = [...html.matchAll(/assets\/[^"']+\.js/g)].map((m) => m[0])
console.log('首页引用 chunk:', entry.join(', ') || '(无)')

const seen = new Set()
let hit = 0
async function scan(paths, depth = 0) {
  for (const p of paths) {
    if (seen.has(p)) continue
    seen.add(p)
    const url = `${BASE}/${p.replace(/^\//, '')}`
    const js = await (await fetch(url)).text()
    const hits = KEYS.filter((k) => js.includes(k))
    if (hits.length) { hit++; console.log(`  HIT ${p}  ${hits.join(', ')}`) }
    if (depth < 1) {
      const more = [...new Set([...js.matchAll(/assets\/[\w.\-]+\.js/g)].map((m) => m[0]))]
      await scan(more, depth + 1)
    }
  }
}
await scan(entry)
console.log(hit ? `\n→ 8090 服务的前端**已含**本次改动(${hit} 个 chunk 命中)` : '\n→ 8090 服务的前端**不含**本次改动(仍是旧包)')
