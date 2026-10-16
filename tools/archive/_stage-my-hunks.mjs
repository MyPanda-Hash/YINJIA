import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

/**
 * _stage-my-hunks.mjs — 工作区里有**另一个会话**并行改动时,只把「本任务」的 hunk 进暂存区。
 *
 * 背景(2026-10-15 实测):同一仓库同时有另一路会话在改制程检验单/成品检验单,
 * 于是 i18n 语言包 / tools/db-migrations.txt / 数据库表清单.md 这些**双方都会碰**的文件里
 * 两批改动混在一起。整文件 `git add` 会把别人的在途工作一起提交。
 *
 * 做法:`git diff -- <file>` → 按 `@@` 切 hunk → 只保留「新增行命中本任务标记」的 hunk
 * → 交给 `git apply --cached`(只动索引,工作区与别人的改动原样不动)。
 *
 * 用法: node tools/archive/_stage-my-hunks.mjs
 */
const RULES = [
  ['frontend/src/i18n/locales/en.js', ['首件检验单(QC_FIRST_INSP']],
  ['frontend/src/i18n/locales/zh-TW.js', ['首件检验单(QC_FIRST_INSP']],
  ['frontend/src/i18n/locales/ja.js', ['首件检验单(QC_FIRST_INSP']],
  ['frontend/src/i18n/locales/ko.js', ['首件检验单(QC_FIRST_INSP']],
  ['frontend/src/i18n/locales/de.js', ['首件检验单(QC_FIRST_INSP']],
  ['frontend/src/i18n/locales/es.js', ['首件检验单(QC_FIRST_INSP']],
  ['frontend/src/i18n/locales/fr.js', ['首件检验单(QC_FIRST_INSP']],
  ['frontend/src/i18n/locales/ru.js', ['首件检验单(QC_FIRST_INSP']],
  ['frontend/src/i18n/locales/vi.js', ['首件检验单(QC_FIRST_INSP']],
  ['frontend/src/i18n/locales/th.js', ['首件检验单(QC_FIRST_INSP']],
  ['tools/db-migrations.txt', ['migrate-first-insp.sql']],
  ['docs/development/数据库表清单.md', ['qc_first_insp', 'v3.19']],
]

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let stagedFiles = 0
let stagedHunks = 0
for (const [file, markers] of RULES) {
  const diff = git(['diff', '--', file])
  if (!diff.trim()) { console.log(`SKIP ${file}: 无改动`); continue }
  const lines = diff.split('\n')
  const headEnd = lines.findIndex((l) => l.startsWith('@@'))
  if (headEnd < 0) { console.log(`SKIP ${file}: 无 hunk`); continue }
  const header = lines.slice(0, headEnd)
  const hunks = []
  let cur = null
  for (const l of lines.slice(headEnd)) {
    if (l.startsWith('@@')) { if (cur) hunks.push(cur); cur = [l] }
    else if (cur) cur.push(l)
  }
  if (cur) hunks.push(cur)
  const mine = hunks.filter((h) => h.some((l) => l.startsWith('+') && markers.some((m) => l.includes(m))))
  if (!mine.length) { console.log(`SKIP ${file}: 没有命中标记的 hunk`); continue }
  const patch = [...header, ...mine.flat()].join('\n')
  const tmp = `.esbuild-tmp/_hunk-${file.replace(/[\\/]/g, '_')}.patch`
  fs.writeFileSync(tmp, patch.endsWith('\n') ? patch : patch + '\n', 'utf8')
  try {
    execFileSync('git', ['apply', '--cached', '--whitespace=nowarn', tmp], { stdio: 'pipe' })
    console.log(`OK   ${file}: 暂存 ${mine.length}/${hunks.length} 个 hunk`)
    stagedFiles++
    stagedHunks += mine.length
  } catch (e) {
    console.log(`FAIL ${file}: git apply --cached 失败\n${String(e.stderr || e.message).slice(0, 500)}`)
  }
}
console.log(`\n共 ${stagedFiles} 个文件 / ${stagedHunks} 个 hunk 进暂存区(其它 hunk 留在工作区,不动)`)
