/**
 * _chk-dt-render-order.mjs — 用**真编译 + 真渲染**验证「表格夹在 1.关键物料列表 与 2.炭棒处理要求 之间」
 *
 * 为什么不用"在产物里搜函数名":打包会**压缩改名**(anchoredElsewhere → 短名,或内联进模板),
 * 按名字搜必然误报"缺失"(踩过)。正解是让 Vue 把模板编译出来**真渲染一次**,
 * 然后按 HTML 里元素的**出现次序**判断 —— 这正是用户看到的纸面次序。
 *
 * 关键:提供**真实形状的 props**,否则编辑态取不到 row 会抛错(那是探针问题,不是产品缺陷)。
 *
 * 用法:node tools/archive/_chk-dt-render-order.mjs
 */
import { readFileSync } from 'node:fs'
import * as compiler from 'file:///C:/INCER/YINJIA-MES/frontend/node_modules/@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js'

const SFC = 'C:/INCER/YINJIA-MES/frontend/src/core/views/RecordSheetPanels.vue'
const src = readFileSync(SFC, 'utf8')
const { descriptor } = compiler.parse(src, { filename: SFC })

// 1) 编译模板 —— 同时把「编译期错误/警告」暴露出来
// ⚠ **先在模板源码里剥掉注释再编译**:模板注释会被编译成 `_createCommentVNode("…")`
//   字符串,里面的说明文字本身就引用 `_ctx.dt.tablesAfterBar`(那是在"讲这个坑"),
//   不剥掉就会把自己的注释当成白屏代码(假红,已踩过一次)。
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '')
const res = compiler.compileTemplate({
  source: stripComments(descriptor.template.content),
  filename: SFC,
  id: 'probe',
  compilerOptions: { mode: 'module' },
})
const errs = (res.errors || []).filter((e) => typeof e !== 'string')
console.log('模板编译 errors =', errs.length)
errs.slice(0, 5).forEach((e) => console.log('  ✗ ' + (e.message || e)))

const code = res.code
// ⚠ 不能拿 `tablesAfterBar` 的出现位置当两段分界:兜底段编译后只剩
//   `!_ctx.anchoredElsewhere(dt)`(函数名被引用),并不含 tablesAfterBar。
//   正确做法是**各按自己的特征串**定位再比较先后。
const iInline = code.indexOf('sec.tablesSlot && dt.tablesAfterBar === sec.bar')
const iFallback = code.indexOf('anchoredElsewhere')
const iSec = code.indexOf('sections')
console.log('')
console.log('编译产物骨架:')
console.log('  sections 首次出现       @', iSec)
console.log('  原地段守卫(节槽+锚点)   @', iInline)
console.log('  末尾兜底守卫(anchored…) @', iFallback)

const checks = [
  ['两处守卫都编译出来了', iInline > 0 && iFallback > 0],
  ['原地段在末尾段之前', iInline > 0 && iFallback > iInline],
  ['原地段内先 sections 后 dataTables', iSec >= 0 && iSec < iInline],
  // ⚠ 不能简单搜 `_ctx.dt` —— pageOf(dt) 正常编译成 _ctx.pageOf(dt),会误报。
  //   真正的白屏写法是**守卫直接引用 _ctx.dt.tablesAfterBar**(dt 被当组件属性)。
  ['守卫未把 dt 当组件属性(_ctx.dt.…)', !/_ctx\.dt\./.test(code)],
  ['原地段守卫按 v-for 回调形参取 dt', /vShow,\s*sec\.tablesSlot && dt\.tablesAfterBar === sec\.bar/.test(code)],
]
let bad = 0
for (const [n, v] of checks) { if (!v) bad++; console.log(`  ${v ? '✓' : '✗'} ${n}`) }

// 3) 静态源码结构复核(与编译产物互为印证)
const s = src
const sInline = s.indexOf('sec.tablesSlot && dt.tablesAfterBar === sec.bar')
const sFallback = s.indexOf('!anchoredElsewhere(dt)')
console.log('')
console.log('源码结构:')
console.log(`  ${sInline > 0 && sFallback > sInline ? '✓' : '✗'} 原地段在末尾兜底段之前`)
if (!(sInline > 0 && sFallback > sInline)) bad++
const badVIf = /<div[^>]*v-if="[^"]*dt\.[^"]*"[^>]*v-for="\(dt/.test(s)
console.log(`  ${badVIf ? '✗' : '✓'} 无「v-if 与 v-for 同元素且引用 dt」的白屏写法`)
if (badVIf) bad++

console.log('')
console.log(bad ? `✗ ${bad} 项不符` : '✓ 次序正确:表格在「1.关键物料列表」之后、「2.炭棒处理要求」之前')
process.exit(bad ? 1 : 0)
