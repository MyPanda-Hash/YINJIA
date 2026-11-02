/**
 * composables-ref.test.js — 防「computed/ref 忘了 .value」的精确定向检查
 *
 * 为什么要有这条(2026-10-30 事故):
 *   MobilePickDoc.vue 里把 `const docId = Number(route.query.id)` 改成
 *   `const docId = computed(...)` 之后,script 里 8 处 `id: docId` 忘了加 `.value`。
 *   于是请求体里的 id 变成了 **"[object Object]"**,后端 400:
 *   Method parameter 'id': Failed to convert value of type 'java.lang.String' to required type 'long'
 *   构建不报错、单测也不覆盖 Vue 组件 ⇒ 直到用户在界面上看到才发现。
 *
 * ★ 为什么不是"扫所有 ref 裸用"
 *   第一版这么写,全仓误报 487 处 —— items / keyword / batchNo 这类**通用词**
 *   会撞上模板变量、注释、emit 事件名、对象字面量的属性名。误报一多这条检查就没人看,
 *   等于没有。⇒ 改成**只查真正会导致请求出错的两种形态**:
 *     ① 请求参数里裸用:含 params: 或 id: 的行;
 *     ② formData 组装里裸用。
 *   这两种一旦漏 .value,序列化出来就是 [object Object],后端直接 400 —— 正是这次事故的形态。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('.', import.meta.url))

/** 明确豁免:名字 → 原因 */
const ALLOW_NAMES = new Map()

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name.endsWith('.vue')) out.push(p)
  }
  return out
}

/** 取 <script> 段文本 */
function scriptOf(vue) {
  const m = vue.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  return m ? m[1] : ''
}

/** 去掉块注释与行注释,避免注释里的词被误判 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

test('请求参数里不得裸用 computed/ref(缺 .value 会变成 [object Object],后端 400)', () => {
  const problems = []
  for (const file of walk(SRC)) {
    const script = stripComments(scriptOf(readFileSync(file, 'utf8')))
    if (!script) continue

    // 收集 ref/computed 声明的名字
    const names = new Set()
    for (const m of script.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:computed|ref)\s*\(/g)) {
      names.add(m[1])
    }
    for (const n of [...names]) if (ALLOW_NAMES.has(n)) names.delete(n)
    if (!names.size) continue

    const lines = script.split(/\r?\n/)
    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      // 只看"把值放进请求/表单"的行
      const inRequest = /\bparams\s*:/.test(trimmed)
        || /\bformData\b/.test(trimmed)
        || /\bid\s*:/.test(trimmed)
        || /\bdata\s*:/.test(trimmed)
      if (!inRequest) return
      for (const name of names) {
        const re = new RegExp(`(^|[^.\\w$'"\`])${name}\\s*(?=[,}\\s])`, 'g')
        let m
        while ((m = re.exec(trimmed)) !== null) {
          const rest = trimmed.slice(m.index + m[0].length)
          if (/^\.value/.test(rest)) continue
          if (new RegExp(`\\b(?:const|let|var)\\s+${name}\\b`).test(trimmed)) continue
          problems.push(`${relative(SRC, file)}:${idx + 1}  ${name}  ->  ${trimmed}`)
        }
      }
    })
  }

  assert.deepEqual(problems, [],
    `发现 ${problems.length} 处请求参数里裸用 ref/computed(缺 .value):\n  `
    + problems.join('\n  '))
})
