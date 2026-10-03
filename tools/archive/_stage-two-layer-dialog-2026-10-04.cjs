/**
 * _stage-two-layer-dialog-2026-10-04.cjs — 把**本次任务(生单弹窗改上下两层)**的改动精确暂存到索引。
 *
 * 为什么又是 hunk 级:同一个工作区里还压着**另一个任务**(特采单 QC_TC_IN 两级审批)的未提交改动,
 * 且与本任务**同文件**(en.js / zh-TW.js 各插了一段「特采 / 送检数量」词条)。AGENTS.md「单任务单提交、
 * 不夹带其它任务改动」要求在 hunk 粒度分开:本任务那两个 hunk 里含「已打印待生单」,另一任务的不含。
 *
 * 用法:node tools/archive/_stage-two-layer-dialog-2026-10-04.cjs [--dry]
 * 跑完自己核对:git diff --cached --stat
 */
'use strict'
const { execFileSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

/** 与另一任务同文件 ⇒ 必须按 hunk 挑 */
const SHARED = [
  'frontend/src/i18n/locales/en.js',
  'frontend/src/i18n/locales/zh-TW.js',
]
/** 本任务 hunk 的判据:新增了「已打印待生单」这一段的 hunk 就是本任务的 */
const MINE = [/已打印待生单/, /勾选即按该批次号生单/]
/** 本任务专有文件(整文件暂存) */
const MINE_ONLY = [
  'frontend/src/core/views/BatchSendDialog.vue',
  'tools/archive/_i18n-material-label-2026-10-04.cjs',
  'tools/archive/_verify-pu-label-ui.cjs',
  'tools/archive/_shot-two-layer-dialog.cjs',
]

function splitDiff(text) {
  const lines = text.split('\n')
  const head = []; const hunks = []; let cur = null
  for (const line of lines) {
    if (line.startsWith('@@')) { if (cur) hunks.push(cur); cur = [line]; continue }
    if (cur) cur.push(line); else head.push(line)
  }
  if (cur) hunks.push(cur)
  return { head, hunks }
}

const DRY = process.argv.includes('--dry')
let staged = 0, skipped = 0
for (const f of SHARED) {
  const d = git(['diff', '--', f])
  if (!d.trim()) { console.log(`- ${f}: 无改动,跳过`); continue }
  const { head, hunks } = splitDiff(d)
  const keep = []
  for (const h of hunks) {
    const body = h.join('\n')
    const hit = MINE.find((re) => re.test(body))
    const added = h.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).trim()).filter(Boolean)
    console.log(`  ${hit ? '[本任务]' : '[其它任务]'} ${f} ${h[0].slice(0, 40)} | 新增样例 ${JSON.stringify(added.slice(0, 2))}`)
    if (hit) { keep.push(h); staged++ } else skipped++
  }
  if (DRY || !keep.length) continue
  // 每个 hunk 末尾是 split 留下的空串,拼接前必须掐掉,否则与下一个 @@ 粘行 → git apply 报 patch does not apply
  const patch = head.join('\n') + '\n' + keep.map((h) => h.join('\n').replace(/\n+$/, '')).join('\n') + '\n'
  const tmp = path.join(os.tmpdir(), 'stage-' + path.basename(f) + '.patch')
  fs.writeFileSync(tmp, patch, 'utf8')
  try {
    git(['apply', '--cached', '--whitespace=nowarn', tmp])
    console.log(`+ ${f}: 暂存 ${keep.length} 个 hunk`)
  } catch (e) {
    const detail = [e.stderr, e.stdout, e.message].map((x) => (x ? x.toString() : '')).join('\n').trim()
    console.error(`✗ ${f}: git apply --cached 失败\n${detail.slice(0, 1200)}`)
    fs.writeFileSync(path.join(__dirname, '_stage-last.patch'), patch, 'utf8')
    process.exit(1)
  } finally { fs.unlinkSync(tmp) }
}

if (DRY) { console.log(`\n[DRY] 本任务 hunk ${staged} / 其它任务 hunk ${skipped}(未暂存)`); process.exit(0) }

for (const f of MINE_ONLY) {
  try { git(['add', '--', f]); console.log(`+ ${f}: 整文件暂存`) }
  catch (e) { console.error(`✗ ${f}: git add 失败 ${String(e.message).slice(0, 200)}`); process.exit(1) }
}
console.log('\n完成;核对:git diff --cached --stat')
