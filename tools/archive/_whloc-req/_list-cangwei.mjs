// 列全 frontend/src 与 backend 里的「仓位」出现点(判断哪些是我们的、哪些是金蝶字段)
import fs from 'node:fs'
import path from 'node:path'

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') walk(p, out) }
    else if (/\.(js|vue|java)$/.test(e.name)) out.push(p)
  }
  return out
}
const roots = ['D:/workspace/yinjia/frontend/src', 'D:/workspace/yinjia/backend/src/main/java']
let total = 0
for (const root of roots) {
  for (const f of walk(root)) {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
    const hits = []
    lines.forEach((L, i) => { if (L.includes('仓位')) hits.push([i + 1, L.trim()]) })
    if (!hits.length) continue
    console.log(`\n### ${f.replace('D:/workspace/yinjia/', '')}  (${hits.length} 处)`)
    for (const [n, L] of hits) { console.log(`  ${String(n).padStart(5)}: ${L.slice(0, 140)}`); total++ }
  }
}
console.log(`\n合计 ${total} 处`)
