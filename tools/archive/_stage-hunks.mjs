// 选择性暂存:从 git diff 中挑出本任务(台账编码过滤)的 hunk,git apply --cached
// 用法: node tools/archive/_stage-hunks.mjs
import { execFileSync } from 'node:child_process'

const run = (args, opts) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 26, ...opts })

// 文件 → 选中 hunk 的判定(命中任一标记即选中;标记取本任务改动里独有的字符串)
const plan = [
  {
    file: 'backend/src/main/java/com/yinjia/mes/service/ButtonService.java',
    markers: ['2026-09-28:改按**编码**联动', 'RTRIM(仓库编码) AS 仓库编码'],
  },
  {
    file: 'frontend/src/core/views/PanelxList.vue',
    markers: ['绑定编码', '存货编码: codes', 'option.value)'],
  },
]

for (const { file, markers } of plan) {
  const diff = run(['diff', '--', file])
  if (!diff) { console.log(`(无 diff)${file}`); continue }
  const lines = diff.split('\n')
  const head = []
  let i = 0
  while (i < lines.length && !lines[i].startsWith('@@')) head.push(lines[i++])
  const hunks = []
  let cur = null
  for (; i < lines.length; i++) {
    if (lines[i].startsWith('@@')) { cur = [lines[i]]; hunks.push(cur) }
    else cur.push(lines[i])
  }
  const picked = hunks.filter(h => markers.some(m => h.some(l => (l.startsWith('+') || l.startsWith('-')) && l.includes(m))))
  console.log(`${file}: hunks=${hunks.length} picked=${picked.length}`)
  for (const h of picked) console.log('   ', h[0])
  const patch = [...head, ...picked.flat()].join('\n') + '\n'
  const tmp = `${process.env.TEMP}\\hunk-${file.replace(/[\\/]/g, '_')}.patch`
  const { writeFileSync } = await import('node:fs')
  writeFileSync(tmp, patch, 'utf8')
  try {
    run(['apply', '--cached', '--recount', tmp])
    console.log(`   staged ✓ (${tmp})`)
  } catch (e) {
    console.error(`   APPLY FAIL: ${e.stdout || ''} ${e.stderr || ''}`)
    process.exit(1)
  }
}
console.log('done')
