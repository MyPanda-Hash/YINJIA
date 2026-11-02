// 只把我这个任务(2026-10-30 实际开工/删除均摊/日期列收口)的 hunk 暂存进 index,
// 工作区里同时存在的**别人未提交的 WIP**(切炭生产任务单下拉项、列设置拖动文案)不进本提交。
// 用法(仓库根): node tools/archive/_verify-actual-start-20261030/_stage-own-hunks.mjs [--apply]
import { execFileSync } from 'node:child_process'

// 文件 → 要保留的 hunk 序号(0-based;按 git diff -U3 输出顺序)
const KEEP = {
  'frontend/src/views/modules/plan/WorkOrderList.vue': [1, 2, 3, 4],   // [0]=切炭下拉(别人的 WIP)
  'frontend/src/views/modules/plan/WorkOrderBoard.vue': [0, 2, 3, 4, 5], // [1]=切炭下拉(别人的 WIP)
  'frontend/src/i18n/locales/en.js': [1, 2],                            // [0]=列设置拖动文案(别人的 WIP)
}
const apply = process.argv.includes('--apply')

for (const [file, keep] of Object.entries(KEEP)) {
  const diff = execFileSync('git', ['diff', '-U3', '--', file], { encoding: 'utf8' })
  const lines = diff.split('\n')
  const headEnd = lines.findIndex((l) => l.startsWith('@@'))
  if (headEnd < 0) { console.log(`${file}: 无 diff,跳过`); continue }
  const header = lines.slice(0, headEnd)
  const hunks = []
  let cur = null
  for (const l of lines.slice(headEnd)) {
    if (l.startsWith('@@')) { if (cur) hunks.push(cur); cur = [l] }
    else if (cur) cur.push(l)
  }
  if (cur) hunks.push(cur)
  const picked = keep.map((i) => hunks[i]).filter(Boolean)
  if (picked.length !== keep.length) throw new Error(`${file}: 期望 ${keep.length} 个 hunk,实到 ${picked.length}(文件被别人改过?)`)
  const patch = [...header, ...picked.flat()].join('\n').replace(/\n*$/, '\n')
  console.log(`\n=== ${file}: 保留 hunk ${keep.join(',')} / 共 ${hunks.length} ===`)
  for (const i of keep) console.log('   ' + hunks[i][0])
  if (apply) {
    execFileSync('git', ['apply', '--cached', '--unidiff-zero', '-'], { input: patch })
    console.log('   -> 已暂存')
  }
}
