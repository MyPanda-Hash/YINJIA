/**
 * _split-hunk.cjs — 从 git diff 里只抽出**含指定标记的那一个 hunk**,用于局部暂存
 *
 * 【为什么需要】一个文件里混了两个任务的改动时,单任务单提交要求只把本任务的 hunk
 *   进索引。`git add -p` 是交互式的,在本环境跑不了,所以手工切 patch 再
 *   `git apply --cached`(只动索引,不动工作区)。
 *
 * 用法:
 *   node tools/archive/_split-hunk.cjs <file> <marker> <out.patch>
 *   git apply --cached <out.patch>
 *
 * marker 用**新增行里出现的稳定串**(如小节标题),不要用会被改写的文字。
 */
const { execFileSync } = require('child_process')
const fs = require('fs')

const [file, marker, out] = process.argv.slice(2)
if (!file || !marker || !out) {
  console.error('用法: node _split-hunk.cjs <file> <marker> <out.patch>')
  process.exit(2)
}

// core.quotepath=false:中文路径原样输出,免得转义后对不上
const diff = execFileSync('git', ['-c', 'core.quotepath=false', 'diff', '--no-color', '--', file], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})

const lines = diff.split('\n')
// 文件头 = 第一个 @@ 之前的所有行(含 diff --git / index / --- / +++)
const firstHunk = lines.findIndex((l) => l.startsWith('@@'))
if (firstHunk < 0) {
  console.error('该文件没有 hunk(可能无改动)')
  process.exit(2)
}
const header = lines.slice(0, firstHunk)

// 切出所有 hunk:每个 @@ 起到下一个 @@ 前
const hunks = []
let cur = null
for (const l of lines.slice(firstHunk)) {
  if (l.startsWith('@@')) {
    if (cur) hunks.push(cur)
    cur = [l]
  } else if (cur) cur.push(l)
}
if (cur) hunks.push(cur)

// 只保留**新增行**里含 marker 的 hunk(标记落在 `+` 行上才是本次要提交的内容)
const hit = hunks.filter((h) => h.some((l) => l.startsWith('+') && !l.startsWith('+++') && l.includes(marker)))
if (hit.length === 0) {
  console.error(`没有 hunk 的新增行含标记「${marker}」—— 换个 marker,别硬凑`)
  process.exit(3)
}
if (hit.length > 1) {
  console.error(`标记「${marker}」命中 ${hit.length} 个 hunk,会多提交 —— 把 marker 写得更唯一`)
  process.exit(3)
}

// 以 \n 结尾,否则 git apply 报 "corrupt patch"
fs.writeFileSync(out, header.concat(hit[0]).join('\n').replace(/\n*$/, '\n'), 'utf8')
console.log(`抽出 1 个 hunk(${hit[0].length} 行)-> ${out}`)
console.log('hunk 头:', hit[0][0])
