/**
 * sheetPrintAllTabs.test.js —— 多页签文书「打印」要一次印出**全部页签**
 *
 * 【需求来源】用户 2026-10-29 口径:
 *   「研发管理有 tap 页的面板,在打印的时候,没有把所有的 tap 页都进行打印,
 *    只能是一个 tap 页打印完再切 tap 页,看看有没有什么办法可以全部 tap 页打印出来」
 *
 * 【现状与差距】打印只有一个路径:body 加 approval-printing 样式后直接 window.print()。
 *   window.print() 只认**当前 DOM**,而 .rsp-pages 之外的页面内容是按 `pageOf(x) === activePage`
 *   用 v-show 显隐的 ⇒ 纸面只出当前页签那一张。多页签要靠人反复切页签再点打印。
 *
 * 【修法】把「多组走 PDF」那条已存在的路扩成「多组 或 多页签 都走 PDF」:
 *   按 buildSheetPdfBlob 的逐页截图拼多页 PDF,在新窗口打开让用户打印 ——
 *   与「导出 PDF」同一份实现,版式零差异。单页单组面板仍走原生 window.print()。
 *
 * 【为什么用源码断言】这类回归几乎都发生在「有人把 if 条件改回 groups.length > 1」
 *   这一行上;mount 整张文书(Element Plus + jsPDF 动态 import)成本极高且脆弱。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const panels = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')

/** printApprovalSheet 函数体(到下一个顶层函数定义为止) */
function printFn() {
  const at = list.indexOf('async function printApprovalSheet')
  assert.ok(at >= 0, '找不到 printApprovalSheet')
  const next = list.indexOf('\nasync function ', at + 10)
  const next2 = list.indexOf('\n// ══════════', at)
  const end = [next, next2].filter((v) => v > at).sort((a, b) => a - b)[0] || at + 3000
  return list.slice(at, end)
}

test('① 打印要读页签数,多页签时不能只印当前页', () => {
  const fn = printFn()
  assert.match(fn, /comp\?\.pageCount|comp\.pageCount/, '打印要读组件暴露的 pageCount')
})

test('② 多页签(或多组)走 PDF 路径', () => {
  const fn = printFn()
  // 关键:条件里必须同时有 pageCount 与 groups,不能只剩 groups.length > 1
  assert.match(fn, /pageCount\s*>\s*1/, '条件要包含「多页签」')
  assert.match(fn, /groups\.length\s*>\s*1/, '条件要保留「多组」')
  assert.match(fn, /buildSheetPdfBlob\(\)/, '与导出共用同一份实现')
})

test('③ 提示语要说清印了几张(用户靠这句话确认全印了)', () => {
  const fn = printFn()
  assert.match(fn, /\{n\}/, '文案要有张数占位符')
  assert.match(fn, /groups\.length|shots|pageCount/, '张数要来自实际出纸数')
})

test('④ 单页单组仍走原生 window.print()(不能为了多页签把简单面板也拖慢)', () => {
  const fn = printFn()
  assert.match(fn, /window\.print\(\)/, '保留原生打印路径')
  assert.match(fn, /approval-printing/, '原生路径仍要加打印样式')
})

test('⑤ 组件真的暴露了 pageCount / setActivePage(打印依赖它们逐页出纸)', () => {
  const ex = panels.slice(panels.indexOf('defineExpose({'), panels.indexOf('defineExpose({') + 1600)
  assert.match(ex, /pageCount:/, 'defineExpose 必须暴露 pageCount')
  assert.match(ex, /setActivePage:/, 'defineExpose 必须暴露 setActivePage')
})

test('⑥ 研发管理的多页签面板确实存在(口径变了要同步本文件)', () => {
  const multi = Object.entries(recordSheetConfigs)
    .filter(([, v]) => (v.pages || []).length > 1)
    .map(([k]) => k)
  // 这 4 张是 2026-10-29 实测的多页签面板;2026-10-30 新增 X烧结工艺清单(2 页)后变 5 张。
  // 数量变化本身不是 bug,但要有人看一眼:打印多页逻辑影响的就是这几张,确认新面板也能整份打印。
  assert.deepEqual(multi.sort(), ['RD_ASM_PROC', 'RD_DOM_TEST', 'RD_MOLD_PROC', 'RD_SPEC_DOC', 'RD_X_SINTER'],
    '多页签面板清单变了 —— 打印多页逻辑影响的就是这几张,确认新面板也能整份打印')
})
