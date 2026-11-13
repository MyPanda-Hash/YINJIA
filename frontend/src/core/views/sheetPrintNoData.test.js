import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * 打印/导出件：配方表不能印成空白、「标准库」字样不能上纸（2026-11-11 用户口径）。
 *
 * 用户原话：「打印错误 配方表打印无数据」「不要显示标准库字样」。
 *
 * 根因（读代码定位，不是猜的）：
 *   · 纸张打印走的是**截图**（PanelxList.openSheetPrint → snapSheetPage → modern-screenshot
 *     的 domToPng）。modern-screenshot 4.7.0 的 copyInputValue 对 textarea **只
 *     setAttribute('value', node.value)**（dist/index.mjs:821），而 <textarea> 在
 *     foreignObject 里显示的是**子文本节点** ⇒ 值根本没画上去。
 *     配方表 7 列 × 10 行全是 el-input type=textarea ⇒ 整张表印成空白，正是用户报的那条。
 *   · 「标准库」入口：⧉ 标准库维护 有 .no-print（截图 filter 认它），但 ⌄ 标准库 只有
 *     .rsp-lib-pick —— 它只在 CSS 的两条打印规则里被隐藏；截图那条路根本不读 CSS ⇒ 上纸。
 *
 * 这些断言钉的是"两条打印路径都必须处理"：
 *   ① 截图路径：snapSheetPage 里把 textarea 的值写回克隆体的文本节点、并把标准库节点摘掉；
 *   ② CSS 路径：@media print 里 .rsp-lib-pick 也要 display:none（原来只有 .rs-lib-btn）。
 */

const LIST_SRC = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const SHEET_SRC = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')

/** 截取 snapSheetPage 函数体（到下一个顶层 async function 之前） */
function snapBody() {
  const i = LIST_SRC.indexOf('async function snapSheetPage(')
  assert.ok(i > 0, 'PanelxList 应有 snapSheetPage')
  const rest = LIST_SRC.slice(i)
  const end = rest.indexOf('\nasync function shotsForPages(')
  assert.ok(end > 0, 'snapSheetPage 之后应是 shotsForPages')
  return rest.slice(0, end)
}

test('① 截图路径:textarea 的当前值要写进克隆体的文本节点（不然配方表印成空白）', () => {
  const body = snapBody()
  assert.match(body, /querySelectorAll\('textarea'\)/, '要取原元素的 textarea 列表')
  assert.match(body, /\.textContent\s*=\s*t\.value/, '值必须写进 textContent（<textarea> 显示的是子文本，不是 value 属性）')
})

test('② 截图路径:⌄ 标准库 / ⧉ 标准库维护 的节点在截图前摘掉', () => {
  const body = snapBody()
  assert.match(body, /querySelectorAll\('\.rsp-lib-pick, \.rs-lib-btn'\)/, '两个标准库入口都要摘，别只摘一个')
  assert.match(body, /\.forEach\(\(n\) => n\.remove\(\)\)/, '是删除节点，不是改样式（截图不读 CSS）')
})

test('③ CSS 路径:@media print 也要隐藏 .rsp-lib-pick（Ctrl+P / 无 body.approval-printing 时）', () => {
  const m = SHEET_SRC.match(/@media print \{ \.no-print, \.rs-lib-btn[^}]*\}/)
  assert.ok(m, '应有一条 @media print 的隐藏规则')
  assert.match(m[0], /\.rsp-lib-pick/, '⌄ 标准库 也要在 @media print 里隐藏')
})
