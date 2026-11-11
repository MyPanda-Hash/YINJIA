#!/usr/bin/env node
/**
 * 从 `git diff` 里只挑「本任务」的 hunk 进暂存区(不夹带工作区里其它任务的在途改动)。
 *
 * 用法:
 *   node filter-patch.cjs <in.patch> <out.patch> drop:<关键字>      // 丢掉正文含该关键字的 hunk
 *   node filter-patch.cjs <in.patch> <out.patch> keep:<关键字>      // 只保留正文含该关键字的 hunk
 * 多个关键字用逗号分隔: keep:可排产量,工序在制
 *
 * 只处理文件级 diff(每个文件一段),保留文件头(-- / index / --- / +++),按 hunk 粒度筛选。
 * 之后用 `git apply --cached <out.patch>` 只写入索引(工作区不动)。
 */
const fs = require('fs')

const [inFile, outFile, rule] = process.argv.slice(2)
if (!inFile || !outFile || !rule) {
  console.error('usage: node filter-patch.cjs <in> <out> <drop:kw|keep:kw>')
  process.exit(2)
}
const [mode, kwPart] = rule.split(':')
const kws = (kwPart || '').split(',').map((s) => s.trim()).filter(Boolean)

const lines = fs.readFileSync(inFile, 'utf8').split(/\r?\n/)
const out = []
let header = []          // 当前文件的头部行(diff --git / index / --- / +++)
let hunks = []           // 当前文件的 hunk 列表(每项 = 行数组)
let inHunk = false

function flushFile() {
  if (!header.length) return
  out.push(...header)
  for (const h of hunks) out.push(...h)
  header = []
  hunks = []
  inHunk = false
}

for (const line of lines) {
  if (line.startsWith('diff --git ')) { flushFile(); header = [line]; inHunk = false; continue }
  if (line.startsWith('@@')) {
    inHunk = true
    hunks.push([line])
    continue
  }
  if (!inHunk) {
    // 文件头(index / --- / +++ / new file mode 等)
    if (header.length) header.push(line)
    else out.push(line)
  } else {
    // hunk 正文:遇到下一个文件头之前的行都归当前 hunk
    if (line.startsWith('diff --git ')) { flushFile(); header = [line]; inHunk = false; continue }
    hunks[hunks.length - 1].push(line)
  }
}
flushFile()

// 现在按 hunk 粒度筛选
const result = []
let i = 0
const src = out
while (i < src.length) {
  if (!src[i].startsWith('diff --git ')) { result.push(src[i]); i++; continue }
  // 收集该文件的头部
  const fileHead = []
  while (i < src.length && !src[i].startsWith('@@')) { fileHead.push(src[i]); i++ }
  // 收集 hunk
  const fileHunks = []
  while (i < src.length && !src[i].startsWith('diff --git ')) {
    if (src[i].startsWith('@@')) fileHunks.push([src[i]])
    else if (fileHunks.length) fileHunks[fileHunks.length - 1].push(src[i])
    i++
  }
  const kept = fileHunks.filter((h) => {
    const body = h.filter((l) => l.startsWith('+') || l.startsWith('-')).join('\n')
    const hit = kws.some((k) => body.includes(k))
    return mode === 'keep' ? hit : !hit
  })
  if (kept.length) { result.push(...fileHead); for (const h of kept) result.push(...h) }
}

fs.writeFileSync(outFile, result.join('\n') + '\n', 'utf8')
console.log(`WROTE ${outFile} (${result.length} lines, rule=${rule})`)
