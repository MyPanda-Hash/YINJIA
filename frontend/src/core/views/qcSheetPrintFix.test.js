/**
 * qcSheetPrintFix.test.js —— 其它制程检验纸面的「打印不全」修复回归(2026-11-16)
 *
 * 【用户口径(2026-11-16)】
 *   ①「主要是修复打印不全的问题」;
 *   ②「组件使用原来的吧」——纸面组件(QcFirstInspSheet / QcProcInspSheet / QcLinePatrolSheet /
 *     QcOqcSheet)保持原样,只改「打印 / 打印预览 / 导出 PDF」的通道。
 *
 * 【实测问题(取证见 tools/archive/_qc-print-audit-20261116/)】
 *   · 首件检验单、巡线检验:纸是 A4 横版宽表,但「导出 → 打印预览」走截图 + 固定 A4 竖版页面
 *     ⇒ 整张缩到约 55%,字很小;
 *   · 出货检验单功能 / 出货检验表观:纸面宽度弹性(窄窗时 300 多 px)+ 内层横向滚动,截图只截到
 *     左半边 ⇒ **右侧列直接缺失(打印不全)**,还带着滚动条和「暂无检验项…」「请选择」提示;
 *   · 原生打印方向靠全局 @page 顺序(靠碰运气),出货检验单声明了竖版却会被 QcLinePatrolSheet
 *     的全局 landscape 规则带走。
 *
 * 【修法(本测试钉住)】
 *   ① previewSheetPdf:对 .ic-sheet/.fi-sheet/.lp-sheet/.qr-sheet 这些单页纸面,改走**原生打印**
 *      (组件原样渲染 + 各自 @media print),不再走截图 → 打印件完整、方向正确;
 *   ② printApprovalSheet:按纸种显式注入 @page(首件/巡线横版;出货检验单竖版;委托单竖版);
 *   ③ snapSheetPage + prepareQrSheetSnapshot:「导出 PDF」对 .qr-sheet 按 A4 纸宽(733px)重排、
 *      撑开滚动容器、摘控件/清占位 ⇒ 右侧列不再缺失。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

/** 截一个函数体(截到下一个顶层 function 之前);async 与否都认 */
function fnBlock(src, name) {
  const at = src.indexOf(`function ${name}(`)
  assert.ok(at >= 0, `找不到 function ${name}`)
  const rest = src.slice(at + 10)
  const end = rest.search(/\n(?:async )?function /)
  return src.slice(at, end < 0 ? undefined : at + 10 + end)
}

test('① 「打印预览」对单页检验纸面走原生打印(不再截图→A4竖版)', () => {
  const preview = fnBlock(list, 'previewSheetPdf')
  // 判据要覆盖首件/巡线/出货检验单(此前只判了 ic-sheet)
  assert.match(preview, /\.fi-sheet/, '要认首件检验单 .fi-sheet')
  assert.match(preview, /\.lp-sheet/, '要认巡线记录表 .lp-sheet')
  assert.match(preview, /\.qr-sheet/, '要认出货检验单 .qr-sheet')
  assert.match(preview, /await printApprovalSheet\(\)/, '要走原生打印通道(组件原样渲染)')
  // 其它纸面(多页签/分组)仍保留统一截图打印层
  assert.match(preview, /await openSheetPrint\('正在生成打印预览…'\)/, '其余纸面仍走 openSheetPrint')
})

test('② 原生打印按纸种注入 @page 方向(宽表横版 / 受控表单竖版)', () => {
  const print = fnBlock(list, 'printApprovalSheet')
  assert.match(print, /fi-sheet',\s*\)|classList\.contains\('fi-sheet'\)/, '要识别首件检验单纸面')
  assert.match(print, /classList\.contains\('lp-sheet'\)/, '要识别巡线记录表纸面')
  assert.match(print, /qc-wide-print-page/, '首件/巡线注入 A4 landscape 打印页')
  assert.match(print, /size: A4 landscape/, '横版纸面显式声明 A4 landscape')
  assert.match(print, /qr-print-page/, '出货检验单注入自己的 A4 portrait 打印页')
  assert.match(print, /size: A4 portrait/, '竖版纸面显式声明 A4 portrait')
})

test('③ 「导出 PDF」对出货检验单按 A4 纸宽重排(修打印不全)', () => {
  const snap = fnBlock(list, 'snapSheetPage')
  assert.match(snap, /isQrSheet/, 'snapSheetPage 要认 .qr-sheet')
  assert.match(snap, /reflow = !isTableStyleSheet && !isQcSheet && \(isQrSheet \|\| paperW > A4_CONTENT_PX\)/,
    '出货检验单必须强制按 A4 内容宽重排(不能按窄容器宽截图)')
  assert.match(snap, /if \(isQrSheet\) prepareQrSheetSnapshot\(clone\)/, '克隆体要做出货检验单专用清理')
  const prep = fnBlock(list, 'prepareQrSheetSnapshot')
  assert.match(prep, /\.no-print/, '摘掉编辑控件')
  assert.match(prep, /\.qr-grid-scroll/, '撑开内层横向滚动容器')
  assert.match(prep, /\.qr-grid'\)[\s\S]{0,80}minWidth = '0'/, '表格按纸宽重排(min-width:0)')
  assert.match(prep, /tableLayout = 'fixed'/, '表格固定列宽按纸宽分配')
  assert.match(prep, /setAttribute\('placeholder', ''\)/, '清掉占位提示')
})

test('④ 原生打印期间把单号写回打印标题(另存 PDF 文件名不再丢单号)', () => {
  // 2026-11-16 用户报障「原来打印的带有单号,现在打印的不带」:
  // 原「打印预览」走 printInPage(title),title = 面板名-单号 ⇒ 另存 PDF 文件名带单号;
  // 改走原生打印后没人设标题 ⇒ 单号丢。这里钉住:打印期间设标题、afterprint 恢复。
  const print = fnBlock(list, 'printApprovalSheet')
  assert.match(print, /document\.title = `\$\{panelName/, '打印期间要有「面板名-…」标题')
  assert.match(print, /单据编号/, '标题里的单号取自「单据编号」')
  assert.match(print, /document\.title = prevTitle/, '打印结束要恢复原标题(别污染标签页)')
})
