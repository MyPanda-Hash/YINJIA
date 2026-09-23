// db-migrations.txt 双链合并(终版 v2):
//   1) 两侧 stage 全文各自按「# —— 」切成条目
//   2) 从头逐条比对,相同条目=公共历史(只保留一份)
//   3) 各自剩余条目按日期交织(同日本地在前)
//   4) bccac4d 的 GBK 坏标题行按提交信息重写
const fs = require('fs')

const FIXED_ENTRY = [
  '# —— 2026-09-18 商品档案自定义字段(金蝶自动扩展字段)接线 ——',
  '#   ①金蝶界面定义自定义字段后 API custom_field 可读(沙箱 custom_field__1__62jiaob3z7yj97 实证:CL004 全链路通);',
  '#   ②bs_inv 增真实列 来料检验(是/否,金蝶维护 MES 只读);③check_type 语义纠正:商品类型(1普通/2套装/3服务,此前误叫检验方式);',
  '#   ④sync-core CF_INSPECTION_KEYS 键登记表(实测按键字典登记);⑤INV 面板 detail 列只读等宽。',
  '#   (编码修复:本条标题+描述在 bccac4d 提交时被写成 GBK 坏字节,2026-09-23 合并云端时按该提交信息重写。)',
]

function load(f) { return fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/) }
let ours = load('_mg-ours.txt').flatMap((l) => l.includes('\uFFFD') ? FIXED_ENTRY : l)
const theirs = load('_mg-theirs.txt')

const isHeader = (l) => /^# —— /.test(l)
function parse(lines) {
  const pre = []
  const out = []
  let cur = null
  for (const line of lines) {
    if (isHeader(line)) { if (cur) out.push(cur); cur = [line] }
    else if (cur) cur.push(line)
    else pre.push(line)
  }
  if (cur) out.push(cur)
  return { pre, entries: out }
}
const A = parse(ours), B = parse(theirs)
let preA = A.pre.join('\n').replace(/\n+$/, '')
const preB = B.pre.join('\n').replace(/\n+$/, '')
if (preA !== preB) {
  // 已知唯一差异:远端 2026-09-21 把 cleanup-base-panels.sql 移出清单(中性化归档),本地行还是旧脚本行
  // → 前缀取远端版(后续决策优先)。除这一处外若还有差异则拒绝合并。
  const a2 = preA.replace(/^cleanup-base-panels\.sql$/m, '').replace(/\n{2,}/g, '\n').trim()
  const b2 = preB.replace(/# ↑ cleanup-base-panels\.sql[^\n]*\n#[^\n]*\n#[^\n]*/m, '').replace(/\n{2,}/g, '\n').trim()
  if (a2 !== b2) { console.error(`公共前缀存在未知差异(ours ${preA.length} / theirs ${preB.length} 字)`); process.exit(1) }
  console.error('前缀唯一差异=cleanup-base-panels.sql 移出清单(远端 09-21 决策) → 取远端前缀')
  preA = preB
}
console.error(`公共前缀 ${A.pre.length} 行;ours 条目 ${A.entries.length} / theirs 条目 ${B.entries.length}`)

const key = (ls) => ls.join('\n').replace(/\s+$/, '')
// 公共条目:从头部起逐条相同者
let ci = 0
while (ci < A.entries.length && ci < B.entries.length && key(A.entries[ci]) === key(B.entries[ci])) ci++
const common = A.entries.slice(0, ci)
const tailA = A.entries.slice(ci)
const tailB = B.entries.slice(ci)
console.error(`公共条目 ${common.length} 条;分叉后 ours ${tailA.length} 条 / theirs ${tailB.length} 条`)
// 分叉后仍可能有小量同文条目(两边各自历史里偶合),按内容再排一次重
const seen = new Set(common.map(key))
const tA = tailA.filter((e) => { const k = key(e); if (seen.has(k)) { console.error('  跳过 ours 重复条目:', e[0].slice(0, 40)); return false } seen.add(k); return true })
const tB = tailB.filter((e) => { const k = key(e); if (seen.has(k)) { console.error('  跳过 theirs 重复条目:', e[0].slice(0, 40)); return false } seen.add(k); return true })

const dateOf = (ls) => (ls[0].match(/(20\d{2}-\d{2}-\d{2})/) || [])[1] || '0000-00-00'
let ai = 0, bi = 0
const mergedTail = []
while (ai < tA.length || bi < tB.length) {
  if (bi >= tB.length || (ai < tA.length && dateOf(tA[ai]) <= dateOf(tB[bi]))) mergedTail.push(tA[ai++])
  else mergedTail.push(tB[bi++])
}
console.error(`交织后尾部 ${mergedTail.length} 条,合计 ${common.length + mergedTail.length} 条`)

const norm = (ls) => { const c = [...ls]; while (c.length && !c[c.length - 1].trim()) c.pop(); return c }
const body = [...common, ...mergedTail].map((e) => norm(e).join('\n'))
const out = preA + '\n\n' + body.join('\n\n') + '\n'
fs.writeFileSync('tools/db-migrations.txt', out, 'utf8')

const names = out.match(/^migrate-[\w.-]+\.sql$/gm) || []
const missing = names.filter((n) => !fs.existsSync('tools/' + n))
console.error(`登记 ${names.length} 条 migrate-*.sql;缺失脚本 ${missing.length} 个${missing.length ? ': ' + missing.join(', ') : ''}`)
if (out.includes('\uFFFD')) { console.error('仍有坏字节!'); process.exit(1) }
console.error('OK')
