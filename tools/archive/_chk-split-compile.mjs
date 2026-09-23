/**
 * _chk-split-compile.mjs — 校验拆段渲染后的结构:编译无错、无 _ctx.dt、两段/表块的位置关系
 *
 * 用法:node tools/archive/_chk-split-compile.mjs
 */
import { readFileSync } from 'node:fs'
import * as compiler from 'file:///C:/INCER/YINJIA-MES/frontend/node_modules/@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js'

const SFC = 'C:/INCER/YINJIA-MES/frontend/src/core/views/RecordSheetPanels.vue'
const src = readFileSync(SFC, 'utf8')
const { descriptor, errors } = compiler.parse(src, { filename: SFC })
console.log('SFC parse errors =', errors.length)

const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '')
const res = compiler.compileTemplate({
  source: stripComments(descriptor.template.content),
  filename: SFC, id: 'p', compilerOptions: { mode: 'module' },
})
const errs = (res.errors || []).filter((e) => typeof e !== 'string')
console.log('模板编译 errors =', errs.length)
errs.slice(0, 6).forEach((e) => console.log('  ✗ ' + (e.message || e)))

const code = res.code
let bad = 0
const chk = (n, v, d) => { if (!v) bad++; console.log(`  ${v ? '✓' : '✗'} ${n}${!v && d ? '  → ' + d : ''}`) }

console.log('')
console.log('=== 结构检查 ===')
chk('无 v-if 与 v-for 同元素引用 dt 的白屏写法(不出现 _ctx.dt.)', !/_ctx\.dt\./.test(code))
chk('锚点判定函数 isAtOrBeforeTableAnchor 已编译进模板', /isAtOrBeforeTableAnchor/.test(code))
chk('不再引用已删除的 anchoredElsewhere', !/anchoredElsewhere/.test(code))
chk('两段章节循环都在(A 条件为真 / B 条件为取反)',
  /isAtOrBeforeTableAnchor\(sec\)/.test(code) && /!isAtOrBeforeTableAnchor\(sec\)|!\(?.*isAtOrBeforeTableAnchor/.test(code.replace(/\s/g, '')))

// 位置关系:循环 A 的 sections 遍历 → 数据表块 → 循环 B
// ⚠ 不能用 `dataTables` 定位:配置对象里也有这个词,会匹配到无关位置(踩过)。
//    用**渲染产物独有**的类名 rsp-dt-wrap 定位数据表块。
const iA = code.indexOf('isAtOrBeforeTableAnchor(sec)')
const iDt = code.indexOf('rsp-dt-wrap')
const iB = code.lastIndexOf('isAtOrBeforeTableAnchor')
console.log('')
console.log('渲染块位置:sections(A) @', iA, ' 数据表(rsp-dt-wrap) @', iDt, ' sections(B) @', iB)
chk('顺序为 A(sections) → 数据表 → B(sections)', iA >= 0 && iDt > iA && iB > iDt,
  `A=${iA} dt=${iDt} B=${iB}`)

console.log('')
console.log(bad ? `✗ ${bad} 项不符` : '✓ 拆段结构正确')
process.exit(bad ? 1 : 0)
