// 从 tools/migrate-whloc.sql 抽出「库位」相关译名插入段(原始值,用于反向改名时复用)
import fs from 'node:fs'
const t = fs.readFileSync('D:/workspace/yinjia/tools/migrate-whloc.sql', 'utf8')
const lines = t.split(/\r?\n/)
const hits = []
lines.forEach((L, i) => {
  if (/yj_translation/i.test(L) || /N'库位/.test(L) || /'库位编码'/.test(L) || /'库位地址'/.test(L) || /'库位'/.test(L)) hits.push(i)
})
const show = new Set()
for (const i of hits) for (let j = Math.max(0, i - 1); j <= Math.min(lines.length - 1, i + 3); j++) show.add(j)
const sorted = [...show].sort((a, b) => a - b)
let prev = -2
for (const j of sorted) {
  if (j !== prev + 1) console.log('   ...')
  console.log(String(j + 1).padStart(5) + ': ' + lines[j])
  prev = j
}
