// 撤掉不再使用的那条词条(「选择时会同时填入…」)—— 用户 2026-10-08 要求把该提示行删除
import fs from 'node:fs'
import path from 'node:path'

const KEY = '选择时会同时填入「大区」和「存储分区」（它们是一个组合）'
const dir = 'D:/workspace/yinjia/frontend/src/i18n/locales'
let n = 0
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const abs = path.join(dir, f)
  const before = fs.readFileSync(abs, 'utf8')
  // 删掉整行(含缩进与行尾逗号)
  const after = before.split(/\r?\n/).filter((L) => !L.includes(KEY)).join('\n')
  if (after !== before) { fs.writeFileSync(abs, after, 'utf8'); console.log(`  ✓ ${f}`); n++ }
  else console.log(`  = ${f} 无该词条`)
}
console.log(`\n清了 ${n} 个语言包`)
