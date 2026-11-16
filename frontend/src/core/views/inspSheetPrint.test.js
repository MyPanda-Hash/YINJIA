/**
 * inspSheetPrint.test.js —— 检验委托单(INSP_COMMISSION)打印/打印预览两条路的版式回归
 *
 * 【用户 2026-11-16 报障(两张截图)】
 *   ①「打印的格式存在问题,字的格式会挤压」;
 *   ②「按钮实现不应该被打印出来」(红框圈住纸面上的「选择检验项目」按钮)。
 *
 * 【根因(实测复现)】
 *   · 侧栏「打印」走 window.print() + `@media print` ⇒ 本来是对的(按钮/日期控件都被藏了);
 *   · 「导出 → 打印预览 / 导出 PDF」走**离屏克隆 + 截图**(`@media print` 对截图不生效)⇒
 *     拍进去的是**屏幕编辑态**:带着「选择检验项目」按钮、日期控件和占位提示;而且克隆体被压到
 *     A4 宽(733px)重排 ⇒ 纸面 880px 的版式被挤窄,位图再放大,字看起来挤在一起。
 *
 * 【修法(本测试钉住)】
 *   ① print 态清理规则**不能只挂在 `body.approval-printing` 下** —— `@media print` 里必须有一条
 *      裸的 `.ic-sheet .ic-pick-btn { display:none }`(Ctrl+P/其它打印入口也适用);
 *      按钮本身也补 `no-print`(截图路径的 domToPng filter 认它);
 *   ② 截图路径(PanelxList)对 `.ic-sheet`:
 *      · 不压 A4 重排(880px 定宽纸,压窄就是用户说的"挤压");
 *      · 用 prepareInspSheetSnapshot 摘掉按钮/日期控件/删行/占位提示;
 *   ③ 「导出 → 打印预览」对 `.ic-sheet` 改走原生打印通道(printApprovalSheet),
 *      与侧栏「打印」同一份矢量版式(位图预览就是这次报障的现场)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const sheet = readFileSync(new URL('../qc/InspCommissionSheet.vue', import.meta.url), 'utf8')

/** 截一个函数体(截到下一个顶层 function 之前);async 与否都认 */
function fnBlock(src, name) {
  const at = src.indexOf(`function ${name}(`)
  assert.ok(at >= 0, `找不到 function ${name}`)
  const rest = src.slice(at + 10)
  const end = rest.search(/\n(?:async )?function /)
  return src.slice(at, end < 0 ? undefined : at + 10 + end)
}

/** 取 @media print 块(从标记到样式结束前的最后一个 `}`) */
function printBlock(src) {
  const at = src.indexOf('@media print')
  assert.ok(at >= 0, '应有 @media print')
  return src.slice(at)
}

test('① 「选择检验项目」按钮带 no-print,且 @media print 有**不依赖 body 类**的隐藏规则', () => {
  // 按钮本身带 no-print:截图路径的 domToPng filter 认这个类,任何截图入口都不会把它拍进去
  assert.match(sheet, /class="ic-pick-btn no-print"/, '按钮要带 no-print(截图路径只认这个类)')
  // 关键:隐藏规则必须有一份**不带 body.approval-printing 前缀**的(裸 @media print 才会命中 Ctrl+P/预览)
  const pb = printBlock(sheet)
  assert.match(pb, /\.ic-sheet \.ic-pick-btn[\s\S]{0,80}display:\s*none\s*!important/,
    '@media print 里要有裸的 .ic-sheet .ic-pick-btn 隐藏规则(不能只挂在 body.approval-printing 下)')
  // 日期控件/删行/占位提示同口径:纸样上没有这些编辑控件
  assert.match(pb, /\.ic-sheet \.ic-date-pick[\s\S]{0,40}display:\s*none/, '日期控件不上纸')
  assert.match(pb, /\.ic-sheet \.ic-date-text\.is-edit-hide[\s\S]{0,40}display:\s*inline/, '日期回到「年 月 日」文字态')
  assert.match(pb, /\.ic-sheet input::placeholder[\s\S]{0,60}color:\s*transparent/, '输入框占位提示不上纸')
})

test('② 印刷态行高有明确值(用户报障「字的格式会挤压」)', () => {
  const pb = printBlock(sheet)
  assert.match(pb, /\.ic-sheet \.ic-grid th,\s*\.ic-sheet \.ic-grid td,[\s\S]{0,100}line-height:\s*1\.5\s*!important/,
    '表格行要显式 line-height,避免密排时上下行贴住')
  assert.match(pb, /\.ic-sheet \.ic-opt,[\s\S]{0,80}line-height:\s*1\.5\s*!important/, '单选项行距同样给足')
})

test('③ 截图路径:ic-sheet 走 html2canvas + 有专门的编辑控件清理函数(不压 A4 重排)', () => {
  const fn = fnBlock(list, 'snapSheetPage')
  assert.match(fn, /isInspSheet/, 'snapSheetPage 要认 .ic-sheet')
  // 定宽纸压到 A4 宽重排 = 用户看到的"挤压";必须提前分流,保持纸面原宽
  assert.match(fn, /if \(isInspSheet\) return await snapInspSheetPage\(el, paperW\)/, 'ic-sheet 提前分流到专用截图')
  const insp = fnBlock(list, 'snapInspSheetPage')
  assert.match(insp, /import\('html2canvas'\)/, 'ic-sheet 截图必须用 html2canvas(其文字排版与屏幕同源)')
  assert.match(insp, /onclone: \(doc, clonedEl\) => prepareInspSheetSnapshot\(clonedEl\)/,
    'html2canvas 的克隆件要做 ic-sheet 专用清理')
  // 不许再退回 modern-screenshot:它的 foreignObject 光栅化对中文衬线字体会换行重叠
  assert.doesNotMatch(insp, /domToPng\(/, 'ic-sheet 截图不许用 modern-screenshot(会重叠)')
  const prep = fnBlock(list, 'prepareInspSheetSnapshot')
  for (const sel of ['.ic-pick-btn', '.ic-items-op', '.no-print']) {
    assert.ok(prep.includes(sel), `清理函数要摘掉 ${sel}`)
  }
  assert.match(prep, /\.ic-date-pick/, '清理函数要摘掉日期控件')
  assert.match(prep, /setAttribute\('placeholder', ''\)/, '清理函数要清掉占位提示')
})

test('④ 导出菜单的「打印预览」:检验委托单走原生打印(与侧栏「打印」同一份版式)', () => {
  const preview = fnBlock(list, 'previewSheetPdf')
  assert.match(preview, /printApprovalSheet\(\)/, '打印预览要复用侧栏「打印」的原生打印通道')
  assert.match(preview, /\.ic-sheet/, '判据是检验委托单纸面')
  // 其它纸面仍然走统一的截图打印层,不能把通用能力删掉
  assert.match(preview, /await openSheetPrint\('正在生成打印预览…'\)/, '其它纸面仍走 openSheetPrint')
})

test('⑤ 中文衬线字体走 html2canvas(modern-screenshot 的 foreignObject 会让文字换行重叠)', () => {
  // 2026-11-16 实测:modern-screenshot 的 SVG foreignObject 里 SimSun / NSimSun / serif 都会
  // 回退成 sans 度量 ⇒ 排版按宋体、出图按黑体,行宽不一致导致行与行叠在一起(用户「挤压」报障)。
  // 纸面是受控表单,不能换字体 ⇒ 只有 html2canvas(按页面实测文本排版)能保证宋体不出错。
  const insp = fnBlock(list, 'snapInspSheetPage')
  assert.match(insp, /html2canvas/, '必须用 html2canvas 渲染 ic-sheet')
  assert.match(insp, /scale:\s*2/, '截图倍率 2(打印清晰度)')
  // 不许为了迁就渲染器改纸张字体:纸面字体由组件 scoped 样式决定
  assert.doesNotMatch(list, /clone\.style\.fontFamily/, '截图路径不许改纸张字体')
})
