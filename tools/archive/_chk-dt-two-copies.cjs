/**
 * _chk-dt-two-copies.cjs — 核对「数据记录表」两处副本是否一致 + 守卫是否成对
 *
 * 背景:为让表格紧贴自己的章节标题,把 163 行的表块在 sections 循环里**原样复制**了一份,
 * 原块加 `v-if="!dt.tablesAfterBar"` 跳过。复制必然带来**漂移风险**(以后只改一份就出鬼),
 * 故这里做机械核对:两份除「首行守卫/key」与整体缩进外必须逐行相同。
 *
 * 用法:node tools/archive/_chk-dt-two-copies.cjs
 */
'use strict'
const fs = require('node:fs')

const FILE = 'C:/INCER/YINJIA-MES/frontend/src/core/views/RecordSheetPanels.vue'
const L = fs.readFileSync(FILE, 'utf8').split('\n')

const starts = []
L.forEach((l, i) => { if (/v-for="\(dt, di\) in cfg\.dataTables"/.test(l)) starts.push(i) })
console.log('两处表块起始行(1-based) =', starts.map((i) => i + 1).join(', '))
if (starts.length !== 2) {
  console.error(`✗ 期望 2 处,实际 ${starts.length} 处`)
  process.exit(1)
}

/** 从起始行取到匹配缩进的 </div> */
function grab(start) {
  const indent = L[start].match(/^(\s*)/)[1].length
  let end = -1
  for (let i = start + 1; i < L.length; i++) {
    const m = L[i].match(/^(\s*)<\/div>\s*$/)
    if (m && m[1].length === indent) { end = i; break }
  }
  return L.slice(start, end + 1)
}

const A = grab(starts[0])
const B = grab(starts[1])
console.log(`副本 A = ${A.length} 行 / 副本 B = ${B.length} 行`)

// 归一化:去首尾空白、去掉两处**本就该不同**的守卫与 key 差异
// ⚠ 守卫改成 v-show 而不是 v-if:同元素上 v-if 优先级高于 v-for,取不到 dt
//   ⇒ 编译成 _ctx.dt.tablesAfterBar ⇒ 每次渲染抛 TypeError、整个面板白屏(2026-09-20 踩过)。
const norm = (s) => s.trim()
  .replace(/v-show="[^"]*"\s*/g, '')
  .replace(/v-if="[^"]*"\s*/g, '')
  .replace(/:key="'sdt'[^"]*"/, ":key=\"'dt' + di\"")
const na = A.map(norm)
const nb = B.map(norm)

let diff = 0
const diffs = []
for (let i = 0; i < Math.max(na.length, nb.length); i++) {
  if (na[i] !== nb[i]) { diff++; diffs.push({ i: i + 1, a: na[i], b: nb[i] }) }
}
console.log(`归一化后差异行 = ${diff}`)
diffs.slice(0, 8).forEach((d) => {
  console.log(`  [行${d.i}]`)
  console.log(`    A: ${String(d.a).slice(0, 120)}`)
  console.log(`    B: ${String(d.b).slice(0, 120)}`)
})

console.log('')
const src = L.join('\n')
const hasGuardClone = /v-show="sec\.tablesSlot && dt\.tablesAfterBar === sec\.bar/.test(src)
const hasGuardOrig = /v-show="!anchoredElsewhere\(dt\)/.test(src)
// ⚠ 守卫一律用 v-show(见文件头注释):若有人在任一表块写回 v-if+dt,就是白屏 bug
const badVIf = /<div[^>]*v-if="[^"]*dt\.[^"]*v-for="\(dt/.test(src) || /<div[^>]*v-for="\(dt[^>]*v-if="[^"]*dt\./.test(src)
console.log(`就地渲染守卫(v-show + 节槽 + 锚点匹配) = ${hasGuardClone}`)
console.log(`末尾兜底守卫(v-show + anchoredElsewhere) = ${hasGuardOrig}`)
console.log(`未出现「v-if 与 v-for 同元素且引用 dt」的白屏写法 = ${!badVIf}`)
console.log('')
const ok = diff === 0 && hasGuardClone && hasGuardOrig && !badVIf
console.log(ok ? '✓ 两份一致且守卫成对(同一张表只会渲染一处)' : '✗ 有问题,见上')
process.exit(ok ? 0 : 1)
