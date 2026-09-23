// db-migrations.txt 合并 v3(重做):git 三方合并给出冲突边界 → 公共核心原样 + 两侧分叉中段按日期织入
const fs = require('fs')
const { execFileSync } = require('child_process')

// 1) 取三个版本
fs.readFileSync('_v3-ours.txt', 'utf8')
fs.readFileSync('_v3-base.txt', 'utf8')
fs.readFileSync('_v3-theirs.txt', 'utf8')

// 2) git merge-file 三方合并(-p 打印到 stdout;冲突退出码非 0 但 stdout 完整)
let merged
try {
  merged = execFileSync('git', ['merge-file', '-p', '_v3-ours.txt', '_v3-base.txt', '_v3-theirs.txt'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
} catch (e) {
  merged = e.stdout
}
const lines = merged.split(/\r?\n/)
const marks = lines.map((l, i) => (/^<{7}/.test(l) ? i : null)).filter((x) => x !== null)
console.error('冲突块数:', marks.length)
if (marks.length !== 1) { console.error('预期 1 个冲突块(与 git merge 一致),实际', marks.length); process.exit(1) }
const s = marks[0]
const m = lines.indexOf('=======')
const e = lines.findIndex((l) => /^>{7}/.test(l))
const pre = lines.slice(0, s)
const oursMid = lines.slice(s + 1, m)
const theirsMid = lines.slice(m + 1, e)
const post = lines.slice(e + 1)
console.error(`核心 ${pre.length} 行 / ours 中段 ${oursMid.length} 行 / theirs 中段 ${theirsMid.length} 行 / 尾 ${post.length} 行`)

// 3) 中段各切成条目(# —— 标题行起),同文条目去重(先出现的保留),再按日期织入(同日 ours 在前)
const isHeader = (l) => /^# —— /.test(l)
function parse(block) {
  const pre2 = [], out = []
  let cur = null
  for (const line of block) {
    if (isHeader(line)) { if (cur) out.push(cur); cur = [line] }
    else if (cur) cur.push(line)
    else pre2.push(line)
  }
  if (cur) out.push(cur)
  return { pre: pre2, entries: out }
}
const A = parse(oursMid), B = parse(theirsMid)

// ours 中段开头的 bccac4d 坏字节行(标题+描述挤一行,GBK 坏字节)→ 重建为规范条目(内容按该提交信息)
const FIXED = [
  '# —— 2026-09-18 商品档案自定义字段(金蝶自动扩展字段)接线 ——',
  '#   ①金蝶界面定义自定义字段后 API custom_field 可读(沙箱 custom_field__1__62jiaob3z7yj97 实证:CL004 全链路通);',
  '#   ②bs_inv 增真实列 来料检验(是/否,金蝶维护 MES 只读);③check_type 语义纠正:商品类型(1普通/2套装/3服务,此前误叫检验方式);',
  '#   ④sync-core CF_INSPECTION_KEYS 键登记表;⑤INV 面板 detail 列只读等宽。',
  '#   (编码修复:本条在 bccac4d 提交时被写成 GBK 坏字节,2026-09-23 合并时按提交信息重写。)',
]
const fixedMid = oursMid.flatMap((l) => l.includes('\uFFFD') ? FIXED : l)
const A2 = parse(fixedMid)
if (A2.pre.some((l) => l.trim()) || B.pre.some((l) => l.trim())) {
  console.error('中段存在标题前散行,需人工确认'); process.exit(1)
}
Object.assign(A, { pre: A2.pre, entries: A2.entries })
const key = (ls) => ls.join('\n').replace(/\s+$/, '')
const dateOf = (ls) => (ls[0].match(/(20\d{2}-\d{2}-\d{2})/) || [])[1] || '0000-00-00'
const seen = new Set()
const tA = [], tB = []
for (const e2 of A.entries) { const k = key(e2); if (seen.has(k)) continue; seen.add(k); tA.push(e2) }
for (const e2 of B.entries) { const k = key(e2); if (seen.has(k)) { console.error('  去重(theirs 同文):', e2[0].slice(0, 44)); continue } seen.add(k); tB.push(e2) }
console.error(`ours 独有条目 ${tA.length} / theirs 独有条目 ${tB.length}`)
let ai = 0, bi = 0
const tail = []
while (ai < tA.length || bi < tB.length) {
  if (bi >= tB.length || (ai < tA.length && dateOf(tA[ai]) <= dateOf(tB[bi]))) tail.push(tA[ai++])
  else tail.push(tB[bi++])
}

const norm = (ls) => { const c = [...ls]; while (c.length && !c[c.length - 1].trim()) c.pop(); return c }
const preTxt = pre.join('\n').replace(/(\r?\n)+$/, '')
const postTxt = post.join('\n').replace(/^(\r?\n)+/, '')
let out = preTxt + '\n\n' + tail.map((e2) => norm(e2).join('\n')).join('\n\n') + '\n'
if (postTxt.trim()) out += '\n' + postTxt.replace(/(\r?\n)+$/, '') + '\n'
fs.writeFileSync('tools/db-migrations.txt', out, 'utf8')

const names = out.match(/^migrate-[\w.-]+\.sql$/gm) || []
const dup = names.filter((x, i) => names.indexOf(x) !== i)
const miss = names.filter((n) => !fs.existsSync('tools/' + n))
console.error(`登记 ${names.length} 条;重复 ${dup.length ? dup.join(',') : '无'};缺失 ${miss.length ? miss.join(',') : '无'}`)
if (out.includes('\uFFFD')) { console.error('存在坏字节!'); process.exit(1) }
// 垃圾行防线:所有非注释、非空行都必须是真实存在的脚本文件名(防 merge 标记/杂散文本混入)
const badLines = out.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !fs.existsSync('tools/' + l))
if (badLines.length) { console.error('非脚本行混入:', badLines.slice(0, 5)); process.exit(1) }
console.error('OK')
