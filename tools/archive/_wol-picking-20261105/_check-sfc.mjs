/* 只做语法/编译检查:SFC 解析 + 模板编译 + script setup 编译(不写产物,不构建) */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('D:/workspace/yinjia/frontend/package.json')
const { parse, compileTemplate, compileScript } = require('@vue/compiler-sfc')
const file = 'D:/workspace/yinjia/frontend/src/views/modules/plan/WorkOrderList.vue'
const src = readFileSync(file, 'utf8')
const { descriptor, errors } = parse(src, { filename: file })
if (errors.length) { console.error('[FAIL] SFC parse:', errors.map(e => e.message)); process.exit(1) }
console.log('[OK] SFC parse: template=' + !!descriptor.template + ' script=' + !!descriptor.scriptSetup)
const t = compileTemplate({ source: descriptor.template.content, filename: file, id: 'wol' })
if (t.errors.length) { console.error('[FAIL] template compile:', t.errors.map(String)); process.exit(1) }
console.log('[OK] template compile')
const s = compileScript(descriptor, { id: 'wol' })
if (!s.content) { console.error('[FAIL] script setup compile'); process.exit(1) }
console.log('[OK] script setup compile, lines=' + s.content.split('\n').length)
// 断言:被删的入口/函数/import 不得再以**代码**形式出现(文档注释里提到函数名是允许的)
const codeBad = [
  ['template/@click 调用', '@click="toPicking"'],
  ['template 按钮权限判断', "canDo('picking')"],
  ['函数定义', 'function toPicking'],
  ['tabs store import', 'useTabsStore'],
  ['tabs.open 调用', 'tabs.open('],
]
let bad = 0
for (const [what, needle] of codeBad) if (src.includes(needle)) { console.error('[FAIL] 仍残留[' + what + ']: ' + needle); bad++ }
if (!bad) console.log('[OK] 按钮/toPicking 函数/useTabsStore/canDo(picking) 的代码残留 = 0(仅文档注释提及)')
process.exit(bad ? 1 : 0)
