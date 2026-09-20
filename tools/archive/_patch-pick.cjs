/**
 * _patch-pick.cjs — 从 git diff 里只挑出指定 hunk,生成可独立 git apply --cached 的补丁
 * 用途:同一文件里既有本任务的改动,又有并行会话未提交的改动时,只提交本任务那一块。
 * 用法:node tools/archive/_patch-pick.cjs <in.patch> <out.patch> <hunk里必须出现的文本>
 */
'use strict'
const fs = require('node:fs')
const [inp, outp, needle] = process.argv.slice(2)
if (!inp || !outp || !needle) { console.error('用法: node _patch-pick.cjs <in.patch> <out.patch> <needle>'); process.exit(2) }
const raw = fs.readFileSync(inp, 'utf8')
const lines = raw.split(/\r?\n/)
const firstHunk = lines.findIndex((l) => l.startsWith('@@'))
if (firstHunk < 0) { console.error('补丁里没有 hunk'); process.exit(1) }
const header = lines.slice(0, firstHunk)
const blocks = []
let cur = null
for (const l of lines.slice(firstHunk)) {
  if (l.startsWith('@@')) { cur = [l]; blocks.push(cur) } else if (cur) { cur.push(l) }
}
const keep = blocks.filter((b) => b.some((l) => l.includes(needle)))
if (!keep.length) { console.error(`没有 hunk 含「${needle}」`); process.exit(1) }
if (keep.length !== 1) { console.error(`命中 ${keep.length} 个 hunk,要求恰好 1 个(避免误提交)`); process.exit(1) }
fs.writeFileSync(outp, header.concat(...keep).join('\n') + '\n', 'utf8')
console.log(`已写出 ${outp}:保留 hunk ${keep[0][0]}`)
