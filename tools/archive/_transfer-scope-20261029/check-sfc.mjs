// check-sfc.mjs — 2026-10-29 调拨改动期间的一次性语法检查(沙箱内 npm run build 会因 esbuild spawn EPERM 失败,
// 故先用 @vue/compiler-sfc 纯 JS 解析:能抓住模板/脚本语法错,抓不到"引用了不存在的东西"这类运行期问题)。
// 用法: node tools/archive/_transfer-scope-20261029/check-sfc.mjs frontend/src/views/.../WorkOrderBoard.vue
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// 从 frontend/package.json 解析依赖(脚本本身体不在 frontend 目录下,ESM 不会往上找 node_modules)
const require = createRequire(new URL('../../../frontend/package.json', import.meta.url))
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc')

const file = process.argv[2]
if (!file) { console.error('usage: node check-sfc.mjs <file.vue>'); process.exit(2) }
const src = readFileSync(file, 'utf8')
const { descriptor, errors } = parse(src, { filename: file })
if (errors.length) { console.error('parse errors:', errors); process.exit(1) }
try {
  compileScript(descriptor, { id: 'check' })
  if (descriptor.template) {
    const t = compileTemplate({ source: descriptor.template.content, filename: file, id: 'check' })
    if (t.errors.length) { console.error('template errors:', t.errors); process.exit(1) }
  }
  console.log('SFC OK:', file)
} catch (e) {
  console.error('compile error:', e && e.message ? e.message : e)
  process.exit(1)
}
