/**
 * _patch-dt-slot.cjs — 把「数据记录表」块在 sections 循环里**再渲染一份**(带守卫),
 * 使表格能紧贴它自己的章节标题,而不是落到同页所有章节之后。
 *
 * 为什么用脚本改而不是手写:块有 163 行,手工重打会打错;脚本按行**原样复制**并只加守卫,
 * 保证两份内容逐字节相同(并在末尾用一次原子写入,减少与并行会话的写-写冲突窗口)。
 *
 * 改动:
 *  ① sections 循环结束标签之后插入一份块副本,外面套
 *     `v-for="(sec, si) in cfg.sections"` + `v-if="sec.tablesSlot" 与 dt.tablesAfterBar 匹配`
 *  ② 原块的首个 div 加 `v-if="!dt.tablesAfterBar"`,避免同一张表渲染两遍
 *  ③ 原块注释补一句"位置约束"说明(防后人再踩)
 *
 * 用法:node tools/archive/_patch-dt-slot.cjs          (执行)
 *      node tools/archive/_patch-dt-slot.cjs --dry    (只看计划)
 */
'use strict'
const fs = require('node:fs')
const FILE = 'C:/INCER/YINJIA-MES/frontend/src/core/views/RecordSheetPanels.vue'
const dry = process.argv.includes('--dry')

const src = fs.readFileSync(FILE, 'utf8')
if (src.includes('__dtSlotCloned__')) {
  console.log('已打过补丁(找到标记),不再重复。')
  process.exit(0)
}

const lines = src.split('\n')
const idxOf = (re, from = 0) => {
  for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i
  return -1
}

// ── 定位 dataTables 块:[div v-for dt] .. 行首 4 空格的 </div> ──
const dv = idxOf(/v-for="\(dt, di\) in cfg\.dataTables"/)
if (dv < 0) throw new Error('没找到 dataTables 的 v-for')
let end = -1
for (let i = dv + 1; i < lines.length; i++) {
  if (/^    <\/div>\s*$/.test(lines[i])) { end = i; break }
}
if (end < 0) throw new Error('没找到 dataTables 块结束的 </div>')
const block = lines.slice(dv, end + 1)
console.log(`dataTables 块 = 行 ${dv + 1}..${end + 1}（${block.length} 行）`)

// ── 定位 sections 循环的 </table>（块后、其前最近的一处）──
const secStart = idxOf(/v-for="\(sec, si\) in cfg\.sections"/)
if (secStart < 0) throw new Error('没找到 sections 的 v-for')
let secEnd = -1
for (let i = secStart + 1; i < lines.length; i++) {
  if (/^    <\/table>\s*$/.test(lines[i])) { secEnd = i; break }
}
if (secEnd < 0) throw new Error('没找到 sections 块的 </table>')
console.log(`sections 循环 </table> = 行 ${secEnd + 1}`)

// ── 生成副本 ──
// ⚠ Vue 里同一元素上 **v-if 优先级高于 v-for**,`v-if` 取不到 `v-for` 的迭代变量。
//   本副本同时需要 sec(sections)与 dt(dataTables)两个作用域 ⇒ 必须用**两层**:
//   外层 template v-for=sec(提供 sec),内层 div v-for=dt(提供 dt),守卫放内层。
const indent = (l) => (l.trim() === '' ? l : '  ' + l)
const clone = block.map(indent)
// 内层 div:只负责表,守卫用 sec/dt(两层作用域都已具备)
clone[0] = clone[0].replace(
  '<div v-for="(dt, di) in cfg.dataTables"',
  '<div v-if="sec.tablesSlot && dt.tablesAfterBar === sec.bar" v-for="(dt, di) in cfg.dataTables"',
)
// key 加前缀,避免与原块 key 冲突
clone[0] = clone[0].replace(':key="\'dt\' + di"', ':key="\'sdt\' + si + \'-\' + di"')

const header = [
  '      <!-- 就地渲染「紧跟本标题」的数据表(仅当该节标了 tablesSlot、且这条表的',
  '           tablesAfterBar 等于本节的 bar 文本)。与下方那份是同一份实现的**原样副本**,',
  '           两处都有 v-if 守着 ⇒ 同一张表只渲染一处,不受影响的面板行为不变。',
  '           ⚠ 外层 template 提供 sec、内层 div 提供 dt —— Vue 的 v-if 优先级高于 v-for,',
  '             同元素上 v-if 取不到 v-for 的迭代变量,故必须分两层写。 -->',
  '      <template v-for="(sec, si) in cfg.sections" :key="\'slot\' + si">',
  ...clone,
  '      </template>',
]

// ── ① 原块首行加"跳过"守卫 ──
const origGuard = lines[dv].replace(
  '<div v-for="(dt, di) in cfg.dataTables"',
  '<div v-if="!dt.tablesAfterBar" v-for="(dt, di) in cfg.dataTables"',
)
if (origGuard === lines[dv]) throw new Error('给原块加守卫失败')

const out = [
  ...lines.slice(0, secEnd + 1),
  '',
  ...header,
  ...lines.slice(secEnd + 1, dv),
  origGuard,
  ...lines.slice(dv + 1),
]

if (dry) {
  console.log('\n--dry：以下将插入 sections 循环之后 ——')
  console.log([...header, ...clone].slice(0, 6).join('\n'))
  console.log('  …')
  console.log('并给原块首行加 v-if="!dt.tablesAfterBar"')
  process.exit(0)
}

fs.writeFileSync(FILE, out.join('\n'), 'utf8')
console.log(`\n✓ 已写入 ${FILE}`)
console.log(`  副本 ${clone.length} 行,插在行 ${secEnd + 1} 之后;原块已加跳过守卫`)
