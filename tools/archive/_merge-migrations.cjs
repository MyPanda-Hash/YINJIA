/**
 * _merge-migrations.cjs — 按「有序并集」合并 tools/db-migrations.txt 的三方冲突(2026-10-25)
 *
 * 背景:merge origin/main 时该清单整片冲突(ours 4214 行 / theirs 4189 行 / base 4110 行)——
 * 两边都在几十处插了脚本,git 的 hunk 互相重叠,于是并成了一整块冲突。
 *
 * 合并规则(保持清单语义:**顺序有讲究** —— 表结构 → 元数据 → 数据 → 翻译 → 视图 → 修复类):
 *   结果 = ours 的顺序为骨架;
 *   对 theirs 里 ours 没有的每一行,插到「theirs 中它前面最近的、且 ours 里也有的那一行」之后。
 *   这样既补齐对方新增的脚本,又不打乱各自原有的相对顺序。
 *
 * 用法:node tools/archive/_merge-migrations.cjs
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..', '..')
const FILE = 'tools/db-migrations.txt'

const read = (stage) => {
  const out = execFileSync('git', ['show', `${stage}:${FILE}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return out.split(/\r?\n/)
}

const ours = read(':2')
const theirs = read(':3')
const base = read(':1')
console.log(`ours=${ours.length} theirs=${theirs.length} base=${base.length}`)

// 逐行做有序并集。用"行内容 → 计数"处理重复行(注释空行会重复出现)。
const result = ours.slice()
const countOf = (arr, line) => arr.filter((x) => x === line).length

let inserted = 0
for (let i = 0; i < theirs.length; i++) {
  const line = theirs[i]
  // 该行在 theirs 的前 i+1 行里出现过几次;result 里若已有同样次数,就说明不缺这一份
  const need = countOf(theirs.slice(0, i + 1), line)
  const have = countOf(result, line)
  if (have >= need) continue

  // 找锚点:theirs 中它前面最近的、result 里也存在的那一行
  let anchor = -1
  for (let j = i - 1; j >= 0; j--) {
    const idx = result.lastIndexOf(theirs[j])
    if (idx >= 0) { anchor = idx; break }
  }
  // 锚点之后要跳过已经排在它后面的连续同族行,尽量贴近原位
  const at = anchor < 0 ? 0 : anchor + 1
  result.splice(at, 0, line)
  inserted++
}

const text = result.join('\n')
fs.writeFileSync(path.join(REPO, FILE), text, 'utf8')

const uniq = new Set(result.filter((l) => l.endsWith('.sql')).map((l) => l.trim()))
console.log(`插入 ${inserted} 行;结果 ${result.length} 行;不同脚本 ${uniq.size} 个`)

// 自查:ours 与 theirs 里的每个 .sql 都必须在结果里
const missing = []
for (const l of [...ours, ...theirs]) {
  const s = l.trim()
  if (!s.endsWith('.sql')) continue
  if (!result.some((x) => x.trim() === s)) missing.push(s)
}
console.log(missing.length ? '缺失脚本: ' + [...new Set(missing)].join(', ') : '自查通过:两边脚本全部在场')
