/**
 * diff-nonmine.mjs — 打印语言包 diff 里**不属于本批**的新增行(并行会话的改动),
 * 用来确认「split-i18n-add.mjs 只暂存本任务」这件事是有依据的。
 *
 * 用法(仓库根):node tools/archive/_return-doc-20261118/diff-nonmine.mjs
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const mineSrc = readFileSync('tools/archive/_return-doc-20261118/add-i18n.mjs', 'utf8')
const mineKeys = new Set([...mineSrc.matchAll(/\['([^']+)',\s*'/g)].map((m) => m[1]))

for (const f of ['frontend/src/i18n/locales/en.js', 'frontend/src/i18n/locales/ja.js']) {
  const diff = execFileSync('git', ['diff', '-U0', '--', f], { encoding: 'utf8' })
  const added = diff.split(/\r?\n/).filter((l) => l.startsWith('+    '))
  const others = added.filter((l) => {
    const m = l.match(/^\+    '([^']+)':/)
    return !m || !mineKeys.has(m[1])
  })
  console.log(`\n=== ${f}: 新增 ${added.length} 行,其中非本批 ${others.length} 行 ===`)
  for (const o of others) console.log('  ' + o)
}
