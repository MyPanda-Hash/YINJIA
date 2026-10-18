/**
 * _q-flow-i18n-gap.mjs —— 流程管控新增文案的英文缺词清单(只读)
 * 用法: node tools/archive/_rd-perm-audit-20261016/_q-flow-i18n-gap.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = 'C:/INCER/YINJIA-MES'
const files = [
  `${root}/frontend/src/core/dashboard/flowSpec.js`,
  `${root}/frontend/src/views/dashboard/FlowBoard.vue`,
]
const set = new Set()
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(/'([^'\\\n]*[\u4e00-\u9fa5][^'\\\n]*)'/g)) set.add(m[1])
  for (const m of s.matchAll(/tt\('([^']+)'\)/g)) set.add(m[1])
}
const en = fs.readFileSync(`${root}/frontend/src/i18n/locales/en.js`, 'utf8')
const all = [...set].sort()
const miss = all.filter((s) => !en.includes(`'${s}':`))
console.log(`流程管控文案 ${all.length} 条,en.js 已有 ${all.length - miss.length} 条,缺 ${miss.length} 条`)
fs.writeFileSync(path.join(process.env.TEMP, 'flow-missing-en.txt'), miss.join('\n'), 'utf8')
console.log('→ 缺词清单写到 ' + path.join(process.env.TEMP, 'flow-missing-en.txt'))
