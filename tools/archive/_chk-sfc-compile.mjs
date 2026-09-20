/**
 * _chk-sfc-compile.mjs — 编译 RecordSheetPanels.vue 并检查模板编译结果与告警
 *
 * 目的:用户报「面板不见了」。此脚本回答两件事:
 *   ① 模板能否编译、有无 error/warning(1 处 tbody 里的非法节点就会让整块表格消失)
 *   ② 编译出的渲染函数里,**我的两处守卫**是否都在(就地渲染 + 末尾跳过)
 *
 * 用法:node tools/archive/_chk-sfc-compile.mjs
 */
import { readFileSync } from 'node:fs'
import * as compiler from 'file:///C:/INCER/YINJIA-MES/frontend/node_modules/@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js'

const FILE = 'C:/INCER/YINJIA-MES/frontend/src/core/views/RecordSheetPanels.vue'
const src = readFileSync(FILE, 'utf8')

const { descriptor, errors } = compiler.parse(src, { filename: FILE })
console.log('SFC parse 错误 =', errors.length)
errors.slice(0, 5).forEach((e) => console.log('  ' + (e.message || e)))

const tpl = descriptor.template
if (!tpl) { console.log('✗ 没有 template 块'); process.exit(1) }

const res = compiler.compileTemplate({
  source: tpl.content,
  filename: FILE,
  id: 'probe',
  compilerOptions: { mode: 'module' },
})

const errs = (res.errors || []).filter((e) => typeof e !== 'string')
const warns = (res.warnings || []) || []
console.log('模板编译 errors =', errs.length)
errs.slice(0, 10).forEach((e) => console.log('  ✗ ' + (e.message || e)))
console.log('模板编译 warnings =', warns.length)
warns.slice(0, 10).forEach((e) => console.log('  ⚠ ' + (e.message || e)))

const code = res.code || ''
console.log('')
console.log('生成代码长度 =', code.length)
const has = (s) => code.includes(s)
console.log('  含 tablesSlot(就地渲染守卫) =', has('tablesSlot'))
console.log('  含 tablesAfterBar(锚点比较) =', has('tablesAfterBar'))
console.log('  含 末尾跳过守卫(!tablesAfterBar) =', /!\s*\w+\s*\.\s*tablesAfterBar|!\(.*tablesAfterBar/.test(code) || has('!dt.tablesAfterBar'))

// 数一下渲染函数里出现几次 rsp-dt-wrap(两份块应各有一次)
console.log('  rsp-dt-wrap 出现次数 =', (code.match(/rsp-dt-wrap/g) || []).length)
console.log('  两处 cfg.dataTables 遍历 =', (code.match(/cfg\.dataTables/g) || []).length)

if (errs.length) { console.log('\n✗ 有编译错误'); process.exit(1) }
console.log('\n✓ 模板编译无错误')
