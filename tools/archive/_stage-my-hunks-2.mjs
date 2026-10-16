import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

/**
 * _stage-my-hunks-2.mjs — 只把「本任务(首件检验测试项目可新增)」的 hunk 进暂存区。
 * 背景同 _stage-my-hunks.mjs:同一仓库有另一路会话在改「成品检验单」,双方都碰
 * docs/development/数据库表清单.md 与 frontend/src/i18n/locales/*.js。
 */
const RULES = [
  ['docs/development/数据库表清单.md', ['v3.23']],
]
const git = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let files = 0, hunks = 0
for (const [file, marks] of RULES) {
  const diff = git(['diff', '--', file])
  if (!diff.trim()) { console.log(`SKIP ${file}`); continue }
  const lines = diff.split('\n')
  const headEnd = lines.findIndex((l) => l.startsWith('@@'))
  if (headEnd < 0) { console.log(`SKIP ${file}`); continue }
  const header = lines.slice(0, headEnd)
  const hs = []
  let cur = null
  for (const l of lines.slice(headEnd)) {
    if (l.startsWith('@@')) { if (cur) hs.push(cur); cur = [l] }
    else if (cur) cur.push(l)
  }
  if (cur) hs.push(cur)
  const mine = hs.filter((h) => h.some((l) => l.startsWith('+') && marks.some((m) => l.includes(m))))
  if (!mine.length) { console.log(`SKIP ${file}: 无命中`); continue }
  const tmp = `.esbuild-tmp/_h2-${file.replace(/[\\/]/g, '_')}.patch`
  fs.writeFileSync(tmp, [...header, ...mine.flat()].join('\n') + '\n', 'utf8')
  try {
    execFileSync('git', ['apply', '--cached', '--whitespace=nowarn', tmp], { stdio: 'pipe' })
    console.log(`OK   ${file}: 暂存 ${mine.length}/${hs.length} hunk`)
    files++; hunks += mine.length
  } catch (e) {
    console.log(`FAIL ${file}: ${String(e.stderr || e.message).slice(0, 400)}`)
  }
}
console.log(`\n${files} 文件 / ${hunks} hunk 进暂存区`)
