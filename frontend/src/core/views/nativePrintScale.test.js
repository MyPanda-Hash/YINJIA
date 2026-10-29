/**
 * nativePrintScale.test.js —— 原生打印(window.print)也要按纸宽**等比缩放**,不能裁掉右边
 *
 * 【需求来源】用户 2026-10-29 口径:
 *   「过宽的可以把表格适当收窄…调整完之后再给原生打印也加等比缩放」
 *
 * 【现状缺陷(实测 8090,见 tools/archive/_print-all-tabs-20261029/_q-overflow.mjs)】
 *   打印样式只有 `body.approval-printing .rsp-sheet { width:100%; zoom:0.92 }`,
 *   而内层表格宽度是**行内 px**(secW(sec) = 网格列宽之和)。
 *   A4 竖向 8mm 边距只能容 733px ⇒ 纸宽 1510px 的面板 ×0.92 后仍 1389px,
 *   **溢出 656px 被直接切掉**,不是缩小。
 *   最宽的测试申请单 1708px 溢出 838px(半个表消失)。
 *
 * 【修法】打印前按「纸张实际宽度 ÷ A4 内容宽」算出 zoom 并写到 CSS 变量上,
 *   样式里用 var() 取值。宽度 ≤ 纸宽时不放大(zoom 上限 1),
 *   只有宽表才缩;缩到多小都在,不裁。
 *
 * 【为什么用源码断言】这类回归几乎都发生在「有人把 zoom 改回写死的 0.92」这一行;
 *   mount 整张文书(Element Plus + 动态 import)成本极高。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const panels = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')

/** 去注释后的源码(注释里会引用旧写法当反例) */
function stripComments(src) {
  return src.split(/\r?\n/)
    .filter((ln) => {
      const t = ln.trim()
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))
    })
    .join('\n')
}

/** printApprovalSheet 函数体 */
function printFn() {
  const at = list.indexOf('async function printApprovalSheet')
  assert.ok(at >= 0, '找不到 printApprovalSheet')
  const end = list.indexOf('\nasync function ', at + 10)
  return stripComments(list.slice(at, end > at ? end : at + 4000))
}

test('① 打印前要按纸宽算缩放比,不能再只靠写死的 zoom', () => {
  const fn = printFn()
  assert.match(fn, /A4_CONTENT_PX|A4ContentPx|A4_CONTENT/, '要声明 A4 内容宽常量(733px @8mm 边距)')
  assert.match(fn, /setProperty\(\s*['"]--print-zoom['"]/, '要把算出的比例写到 --print-zoom 上')
})

test('② 缩放比 = 纸宽 ÷ A4 内容宽,且不超过 1(窄表不放大)', () => {
  const fn = printFn()
  assert.match(fn, /Math\.min\(\s*1\s*,/, 'zoom 上限 1,否则窄表会被异常放大')
  assert.match(fn, /Math\.max\([^)]*0\.[0-9]/, '要有下限保护,别缩到看不见')
})

test('③ 打印样式读变量,不再写死 0.92', () => {
  const style = stripComments(panels)
  assert.match(style, /zoom:\s*var\(--print-zoom/, '.rsp-sheet 的 zoom 要读 var(--print-zoom)')
  assert.ok(!/zoom:\s*0\.92\s*!important/.test(style), '不能再写死 zoom: 0.92')
})

test('④ 打印结束要清掉变量(不能影响后续正常显示)', () => {
  const fn = printFn()
  assert.match(fn, /removeProperty\(\s*['"]--print-zoom['"]|removeProperty\('--print-zoom'\)/,
    '收尾要移除 --print-zoom,否则关掉打印预览后页面还是缩的')
})

test('⑤ 变量挂在 <html> 上(reset 一处即可,不依赖具体纸张元素)', () => {
  const fn = printFn()
  assert.match(fn, /documentElement\.style/, '变量挂 documentElement,样式里用全局 var()')
})
