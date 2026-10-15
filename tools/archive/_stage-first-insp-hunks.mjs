/*
 * _stage-first-insp-hunks.mjs — 只把「首件检验单完工回填」这一处改动放进暂存区。
 *
 * 背景:同一棵工作树里还有另一个任务在改 `ButtonService.java`(组装成品检验单预铺检验项),
 * 而 AGENTS 要求「一个任务一个 commit」。`git add -p` 是交互式的、脚本里没法用,所以这里按
 * **hunk 内容**挑:只保留含本任务标记的 hunk,拼成补丁用 `git apply --cached` 只写索引,
 * 工作区文件(含另一个任务的改动)一律不动。同 `tools/archive/_stage-my-hunks.mjs` 的先例。
 *
 * 用法: node tools/archive/_stage-first-insp-hunks.mjs [--dry]
 */
import { execFileSync } from 'node:child_process'

const FILE = 'backend/src/main/java/com/yinjia/mes/service/ButtonService.java'
/** 本任务标记:出现这几串之一的行所在 hunk 才要(唯一指向本次改动) */
const MARKERS = ['FirstInspBackfill', '生产日期 + 批号(2026-10-16 第二轮用户口径']
const dry = process.argv.includes('--dry')
const git = (args, input) => execFileSync('git', args, { cwd: 'D:/workspace/yinjia', input, encoding: 'utf8' })

const diff = git(['diff', '--', FILE])
if (!diff.trim()) { console.log('该文件没有未暂存改动'); process.exit(0) }
const lines = diff.split('\n')
const headEnd = lines.findIndex((l) => l.startsWith('@@'))
const header = lines.slice(0, headEnd).join('\n') + '\n'
const hunks = []
let cur = null
for (const l of lines.slice(headEnd)) {
  if (l.startsWith('@@')) { if (cur) hunks.push(cur); cur = [l]; continue }
  if (cur) cur.push(l)
}
if (cur) hunks.push(cur)

const mine = hunks.filter((h) => h.some((l) => l.startsWith('+') && MARKERS.some((m) => l.includes(m))))
console.log(`全部 hunk ${hunks.length} 个,属于本任务的 ${mine.length} 个`)
if (!mine.length) { console.log('没找到本任务的 hunk(可能已被别人提交?)'); process.exit(1) }
for (const h of mine) console.log('  ' + h[0] + ' +' + h.filter((l) => l.startsWith('+')).length + ' 行')
const patch = header + mine.map((h) => h.join('\n')).join('\n')
if (dry) { console.log('--- 补丁(前 40 行)---\n' + patch.split('\n').slice(0, 40).join('\n')); process.exit(0) }
git(['apply', '--cached', '--recount', '-'], patch)
console.log('已写入索引(工作区未动)。核对: git diff --cached --stat')
