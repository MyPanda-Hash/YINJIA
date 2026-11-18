// 把两个 .vue 的 diff 按 hunk 拆成「列固定(pin)」与「区间外格可填(oob)」两份 patch
// 用法:node tools/archive/_wo-chain-verify-20261118/_split-hunks.mjs
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const ROOT = 'D:/workspace/yinjia'
const files = {
  'frontend/src/views/modules/plan/WorkOrderBoard.vue': { pin: [0, 2, 3, 4, 5], oob: [1, 6, 7, 8, 9] },
  'frontend/src/views/modules/plan/WorkOrderList.vue': { pin: [0, 2, 3, 5], oob: [1, 4, 6, 7, 8] },
}
const out = { pin: '', oob: '' }
for (const [file, split] of Object.entries(files)) {
  const diff = execFileSync('git', ['diff', '-U2', '--', file], { cwd: ROOT, encoding: 'utf8' })
  const lines = diff.split('\n')
  const firstHunk = lines.findIndex((l) => l.startsWith('@@'))
  const header = lines.slice(0, firstHunk).join('\n')
  const hunks = []
  let cur = []
  for (const l of lines.slice(firstHunk)) {
    if (l.startsWith('@@')) { if (cur.length) hunks.push(cur); cur = [l] } else cur.push(l)
  }
  if (cur.length) hunks.push(cur)
  if (hunks.length !== 10 && hunks.length !== 9) console.log('WARN hunk count', file, hunks.length)
  for (const key of ['pin', 'oob']) {
    const picked = split[key].map((i) => hunks[i].join('\n')).join('\n')
    out[key] += header + '\n' + picked + (picked.endsWith('\n') ? '' : '\n')
  }
}
writeFileSync(ROOT + '/.tmp-pin.patch', out.pin)
writeFileSync(ROOT + '/.tmp-oob.patch', out.oob)
console.log('pin patch lines', out.pin.split('\n').length, 'oob patch lines', out.oob.split('\n').length)
