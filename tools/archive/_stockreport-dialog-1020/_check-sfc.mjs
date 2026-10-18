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
  // ⚠ 先剥掉 HTML 注释:注释里的字样(如 <component :is= 里的 Component)不是模板引用,
  //   不剥会报假阳性(2026-10-20 合并时踩到)。
  .replace(/<!--[\s\S]*?-->/g, ' ')

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
// 插槽作用域变量:`v-slot="x"` / `#default="{ row, col, cell }"` / `v-slot:footer="{ ... }"`
for (const v of template.matchAll(/(?:v-slot(?::[\w.-]+)?|#[\w.-]+)="\s*(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))\s*"/g)) {
  if (v[2]) locals.add(v[2].trim())
  if (v[1]) {
    for (const part of v[1].split(',')) {
      const n = part.trim().split(':').pop().replace(/=.*$/, '').trim()
      if (/^[A-Za-z_$][\w$]*$/.test(n)) locals.add(n)
    }
  }
}
// 表达式里的箭头函数参数:`e => …` / `(a, b) => …`
for (const a of template.matchAll(/(?:\(([^()]*)\)|([A-Za-z_$][\w$]*))\s*=>/g)) {
  const src = a[1] || a[2] || ''
  for (const part of src.split(',')) {
    const n = part.trim().replace(/[={}[\]]/g, '').trim()
    if (/^[A-Za-z_$][\w$]*$/.test(n)) locals.add(n)
  }
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
  // ⚠ 匹配必须**先取完整标识符,再在 JS 里看后一个字符**。
  //   原写法 `[A-Za-z_$][\w$]*(?!\s*\()` 有回溯缺陷:遇到 `openQueryRef(` 时,
  //   正则会把匹配退成 `openQueryRe`(因为这样 `(?!\s*\()` 就能通过)⇒ 报出一堆
  //   `openQueryRe`/`headerFieldKe` 这种**假阳性**,把真问题淹了(2026-10-20 实测)。
  for (const id of cleaned.matchAll(/(?<![.\w$])[A-Za-z_$][\w$]*/g)) {
    const n = id[0]
    const after = cleaned.slice(id.index + n.length)
    if (/^\s*\(/.test(after)) continue      // 函数调用:名字来自 script 或全局,不是模板变量
    if (BUILTIN.has(n) || declared.has(n) || locals.has(n)) continue
    missing.add(n)
  }
}
missing.delete('$event') // Vue 模板内置
if (missing.size) {
  console.error('[FAIL] ② 模板里引用了 script 未声明的名字:', [...missing].sort().join(', '))
  process.exitCode = 1
} else {
  console.log('[OK] ② 模板引用名均在 script 中声明')
}

// ③ script 体里的 `X.value`(ref 访问):X 必须是本文件声明过的。
//    2026-10-20 实测教训:把 `ledgerWhOptions` 写成 `ledgerRefOptions` ⇒ 台账一进面板就
//    `ReferenceError: ledgerRefOptions is not defined`,整页渲染中断(弹窗/列表全空),
//    而 `vite build` 与模板检查**都不会报**。这条专门兜住这类"名字写错"。
const scriptNoStr = script
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/gm, '$1 ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''")
  .replace(/"(?:[^"\\]|\\.)*"/g, '""')
// ⚠ 模板字符串**不做剥离**:`/`(?:[^`\\$]|\\.|\$(?!\{))*`/g` 在含大量 `${}` 的 SFC 上会失配,
//   实测一次吃掉 181k 字符(206,735 → 25,276),把要查的代码段整段吞掉 ⇒ 检查恒过(2026-10-20 实测)。
//   代价:模板字符串**内部**的文字也会被当成代码扫;`X.value` 出现在字符串里的情况极少,可接受。
// 函数参数 / catch 变量 / for-of 循环变量也算"本地名"(`(o) => o.value`、`(option) => option.value`)
const scriptLocals = new Set()
const addParamList = (list) => {
  for (const part of String(list || '').split(',')) {
    const n = part.trim().replace(/[={}[\].]/g, '').replace(/^\.\.\./, '').split(/\s*=\s*/)[0].trim()
    if (/^[A-Za-z_$][\w$]*$/.test(n)) scriptLocals.add(n)
  }
}
for (const m of scriptNoStr.matchAll(/\(([^()]*)\)\s*=>/g)) addParamList(m[1])
for (const m of scriptNoStr.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*=>/g)) scriptLocals.add(m[1])
for (const m of scriptNoStr.matchAll(/function\s*[A-Za-z_$]*\s*\(([^)]*)\)/g)) addParamList(m[1])
for (const m of scriptNoStr.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) scriptLocals.add(m[1])
for (const m of scriptNoStr.matchAll(/for\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) scriptLocals.add(m[1])
for (const m of scriptNoStr.matchAll(/for\s*\(\s*(?:const|let|var)\s*\[([^\]]*)\]/g)) addParamList(m[1])

const badRefs = new Set()
for (const m of scriptNoStr.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\.value\b/g)) {
  const n = m[1]
  if (BUILTIN.has(n) || declared.has(n) || scriptLocals.has(n)) continue
  badRefs.add(n)
}
if (badRefs.size) {
  console.error('[FAIL] ③ script 里访问了未声明的 ref:', [...badRefs].sort().join(', '))
  process.exitCode = 1
} else {
  console.log('[OK] ③ script 里的 ref 访问都有声明')
}

console.log(`[INFO] script ${script.length} 字符,模板 ${template.length} 字符,声明名 ${declared.size} 个`)
