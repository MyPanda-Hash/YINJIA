/**
 * 产品文件列表「模板用了、脚本没定义」回归闸（2026-11-10 生产事故）。
 *
 * 事故：`ProdDocListSheet.vue` 模板里写了 `:title="approveTitle(row, c)"`，脚本漏定义该函数。
 * 该单元格只在「管理员 × 规格书列 × 状态=开发完毕」时渲染，所以平时看不见；
 * 生产一有这个组合，渲染即抛 `TypeError: approveTitle is not a function`，
 * Vue 丢掉整棵子树 ⇒ 用户看到**整个产品文件列表空白**。
 *
 * 这里把该组件模板里用到的函数名逐个对脚本做存在性检查：
 * 漏一个就说明这条路径某天会以"整页空白"的形式爆出来。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, 'ProdDocListSheet.vue'), 'utf8')

/** 模板里以 `name(` 形式出现在绑定/事件中的函数（排除 tt/ElMessage 这类外部导入） */
const EXTERNAL = new Set(['tt', 'ElMessage', 'Number', 'String', 'Math', 'JSON'])

test('ProdDocListSheet 模板用到的每个函数都在脚本里有定义（防"整页空白"）', () => {
  const tpl = src.slice(src.indexOf('<template>'), src.indexOf('<script setup>'))
  const names = new Set()
  for (const m of tpl.matchAll(/[{:@][^=]*?=\s*"([^"]+)"/g)) {
    for (const c of m[1].matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) names.add(c[2])
  }
  for (const m of tpl.matchAll(/@[a-z.]+="([^"]+)"/g)) {
    for (const c of m[1].matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) names.add(c[2])
  }
  const script = src.slice(src.indexOf('<script setup>'))
  const missing = [...names].filter((n) => !EXTERNAL.has(n)
    && !new RegExp(`(function|const|let)\\s+${n}\\b`).test(script)
    && !new RegExp(`[{,]\\s*${n}\\s*[,}]`).test(script))
  assert.deepEqual(missing, [], `这些模板函数没有定义：${missing.join('、')}`)
})
