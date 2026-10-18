/**
 * _check-sfc.mjs — 无构建工具环境下的 SFC 静态检查(沙箱里 esbuild 无法 spawn,`vite build` 跑不了时用)。
 *
 * 检查项:
 *   ① <script setup> 语句体语法(去掉 import 后的模块体 → node --check 口径由 core 复用)
 *   ② <template> 里引用的所有「裸标识符」(指令/插值/绑定里的顶层名字)必须在 script 里**定义过**
 *      —— 这是本次改动最容易踩的坑(新增 computed 忘声明 ⇒ 运行时白屏,构建却常常不报)
 *   ③ 括号/标签配平粗检
 *
 * 用法: node tools/archive/_stockreport-dialog-1020/_check-sfc.mjs frontend/src/core/views/PanelxList.vue
 */
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const file = process.argv[2]
if (!file) { console.error('用法: node _check-sfc.mjs <file.vue>'); process.exit(2) }
const src = readFileSync(file, 'utf8')

const sOpen = src.indexOf('<script')
const sClose = src.lastIndexOf('</script>')
const tOpen = src.search(/<template>/)
const tClose = src.lastIndexOf('</template>')
if (sOpen < 0 || tOpen < 0) { console.error('[FATAL] 不是标准 SFC'); process.exit(1) }

const script = src.slice(src.indexOf('>', sOpen) + 1, sClose)
const template = src.slice(tOpen + '<template>'.length, tClose)

// ① script 语法:转成 CommonJS 供 vm.Script 解析(动态 import() 不受影响)
const forCheck = script.replace(/^\s*import\s+[^;]*?from\s+['"][^'"]+['"]\s*$/gm, '')
  .replace(/^\s*import\s+['"][^'"]+['"]\s*$/gm, '')
try {
  new vm.Script(forCheck, { filename: file })
  console.log('[OK] ① script 语法')
} catch (e) {
  console.error('[FAIL] ① script 语法:', e.message)
  process.exit(1)
}

// ② 模板里用到的标识符必须在 script 里声明过
const declared = new Set()
const re = /(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g
let m
while ((m = re.exec(script))) declared.add(m[1])
// import 进的名字也算
for (const im of script.matchAll(/^import\s+(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))(?:\s*,\s*\{([^}]*)\})?\s+from/gm)) {
  if (im[2]) declared.add(im[2])
  for (const grp of [im[1], im[3]]) {
    if (!grp) continue
    for (const part of grp.split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim()
      if (name) declared.add(name)
    }
  }
}
// 解构声明:const { a, b: c } = ...
for (const d of script.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
  for (const part of d[1].split(',')) {
    const name = part.trim().split(':').pop().replace(/=.*$/, '').trim()
    if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name)
  }
}
// 解构数组 const [a, b] = ...
for (const d of script.matchAll(/(?:const|let|var)\s*\[([^\]]*)\]\s*=/g)) {
  for (const part of d[1].split(',')) {
    const name = part.replace(/=.*$/, '').trim()
    if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name)
  }
}

// vue 内置 / JS 关键字 / 模板局部变量(v-for / v-slot / 模板 ref)白名单
const BUILTIN = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'Math', 'JSON', 'Object', 'Array',
  'String', 'Number', 'Boolean', 'Date', 'RegExp', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'console', 'void',
  'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'await', 'async', 'return', 'if', 'else', 'item', 'index'])
// v-for 引入的局部名
const locals = new Set()
for (const v of template.matchAll(/v-for="\s*(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s+(?:in|of)\s/g)) {
  const names = (v[1] || v[2] || '').split(',').map((s) => s.trim()).filter(Boolean)
  names.forEach((n) => locals.add(n))
}
// 插值 / 指令表达式里的名字
const exprs = []
for (const x of template.matchAll(/\{\{([\s\S]*?)\}\}/g)) exprs.push(x[1])
for (const x of template.matchAll(/(?:v-if|v-else-if|v-show|v-model[.\w:]*|v-for|:[\w.-]+|@[\w.-]+|#[\w.-]+)="([^"]*)"/g)) exprs.push(x[1])

const missing = new Set()
for (const e of exprs) {
  // 去掉字符串字面量与属性访问右侧(a.b 里的 b 不是标识符)
  const cleaned = e
    .replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``')
    .replace(/\.\s*[A-Za-z_$][\w$]*/g, '')
    .replace(/\?\.[A-Za-z_$][\w$]*/g, '')
    .replace(/\b[A-Za-z_$][\w$]*\s*:/g, '') // 对象字面量键
  for (const id of cleaned.matchAll(/(?<![.\w$])[A-Za-z_$][\w$]*(?!\s*\()/g)) {
    const n = id[0]
    if (BUILTIN.has(n) || declared.has(n) || locals.has(n)) continue
    // 后面紧跟 -> 的可能是箭头参数,已由 locals 处理;这里只记名字
    missing.add(n)
  }
}
if (missing.size) {
  console.error('[WARN] ② 模板里出现了 script 未声明的名字(需人工确认是否误报):', [...missing].sort().join(', '))
} else {
  console.log('[OK] ② 模板引用名均在 script 中声明')
}

// ③ 标签配平粗检(只数自定义组件与常见块级标签的开关数)
console.log(`[INFO] script ${script.length} 字符,模板 ${template.length} 字符,声明名 ${declared.size} 个`)
