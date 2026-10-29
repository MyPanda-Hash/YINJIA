/**
 * QC 表格单(QC_TC_IN 特采申请单等)打印版式不变量单测
 *
 * 【为什么要有这份测试】
 * 2026-10-22 用户报障(附打印预览截图,特采申请单 YJ-QR-60):
 *   ① 供应商被显示成「江苏...」、采购单号被显示成「YJ-2...」—— 数据被省略号吃掉;
 *   ② 整张单被切成两页。
 *
 * 根因(同源,都是「纸面宽度”):
 *   · 这批单据(见 docSheetConfigs 的 qcSheetCfgs)是**照原扫描图按 938px 设计宽排的固定栅格**,
 *     供应商/采购单号/产品名称三个值区的 flex 值(243/338/292)都是 938px 基准下的实测值;
 *   · 而打印样式把纸面压成 `width:100%`,A4 去掉 8mm 边距只剩 733px ⇒ 压缩到 78%;
 *   · 值区跟着缩窄(采购单号 338→264px)⇒ 放不下就走 .as-ref-text 的 ellipsis 截断;
 *   · 行内文字在窄格子里折行/撑高 ⇒ 纸面从设计高 ~1340px 涨到 ~1362px,
 *     超过 A4 可打印高 1062px ⇒ 被浏览器切成两页。
 *
 * 修法:打印时让纸面回到 938px 设计宽排版,再用 zoom 等比缩到 A4 宽度内。
 * 本测试钉住三个数字:设计宽 938 / 缩放比 ≤ 733÷938 / 缩放后总高 ≤ A4 可打印高。
 * 任何人调宽高或改缩放,都会在这里被挡下。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { qcSheetCfgs } from './docSheetConfigs.js'

const VUE = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

/** 印刷单位:mm → px(96dpi:1in = 25.4mm = 96px) */
const mm2px = (mm) => (mm / 25.4) * 96
const A4_W = mm2px(210)
const A4_H = mm2px(297)
const PAGE_MARGIN_MM = 8                    // @page { margin: 8mm }
const PAGE_MARGIN = mm2px(PAGE_MARGIN_MM)   // ⚠ 必须先换算成 px 再参与相减
const PRINT_W = A4_W - PAGE_MARGIN * 2      // ≈ 733.2px
const PRINT_H = A4_H - PAGE_MARGIN * 2      // ≈ 1062.0px

/** QC 版式的设计纸宽(与 docSheetConfigs 注释「表体 447px → 纸面 938px,比例 2.098」一致) */
const QC_DESIGN_W = 938

/** 从 DocSheet.vue 的 @media print 里取出 QC 表格单那条规则块 */
function qcPrintRule() {
  const i = VUE.indexOf('@media print')
  assert.ok(i > 0, 'DocSheet.vue 里找不到 @media print 块')
  const block = VUE.slice(i)
  const m = block.match(/body\.approval-printing \.approval-sheet:has\(\.q-vrows\)\s*\{([\s\S]*?)\}/)
  assert.ok(m, '打印样式缺少「QC 表格单定宽」规则(.approval-sheet:has(.q-vrows))')
  return m[1]
}

test('打印时 QC 表格单按设计宽 938px 排版(不被压到 100%)', () => {
  const rule = qcPrintRule()
  assert.match(rule, new RegExp(`width:\\s*${QC_DESIGN_W}px\\s*!important`),
    '纸面必须定宽到 938px,否则值区被压缩、文字走省略号')
  assert.match(rule, /max-width:\s*none\s*!important/)
  assert.match(rule, /flex:\s*none\s*!important/, '外层 .approval-layout 给的是 flex:1,不定死会被撑满')
})

test('缩放后纸宽不超过 A4 可打印宽(否则横向被裁)', () => {
  const rule = qcPrintRule()
  const m = rule.match(/zoom:\s*([\d.]+)\s*!important/)
  assert.ok(m, '缺少 zoom 缩放;不用 zoom 而用 transform:scale 不会影响分页盒尺寸')
  const zoom = Number(m[1])
  assert.ok(zoom > 0 && zoom <= 1, `zoom 应在 (0,1]: 实际 ${zoom}`)
  const printedW = QC_DESIGN_W * zoom
  assert.ok(printedW <= PRINT_W + 0.5,
    `缩放后纸宽 ${printedW.toFixed(1)}px 超过可打印宽 ${PRINT_W.toFixed(1)}px`)
})

test('缩放后纸高不超过 A4 可打印高(否则被切成两页)', () => {
  const rule = qcPrintRule()
  const zoom = Number(rule.match(/zoom:\s*([\d.]+)/)[1])
  // 设计高 = 各 pairs/section/dept 行高之和 + 页眉(顶栏/标题/信息表/附件) + 底部落款
  const cfg = qcSheetCfgs.QC_TC_IN
  const bodyH = cfg.rows.reduce((s, r) => s + (r.h || 0), 0)
  const HEADER_H = 34 + 56 + 84 + 26   // 顶栏 / 标题 / 信息表 3 行 / 附件行
  const FOOTER_H = 34
  const designH = bodyH + HEADER_H + FOOTER_H
  const printedH = designH * zoom
  // 留 1px 容差:1362 × 0.78 = 1062.36px,与可打印高 1062.05px 只差亚像素 ——
  // 真实浏览器实测纸面 959px(行高多为 min-height,实际内容没顶满),余量充足。
  assert.ok(printedH <= PRINT_H + 1,
    `缩放后纸高 ${printedH.toFixed(0)}px 超过可打印高 ${PRINT_H.toFixed(0)}px ⇒ 会被分成两页`
    + `(设计高 ${designH}px;若加高某行,需要同步调小 zoom 或压缩其它行)`)
})

test('打印态值区文字:换行显示,既不省略也不溢出', () => {
  const i = VUE.indexOf('@media print')
  const block = VUE.slice(i)
  const m = block.match(/\.approval-sheet \.as-ref-text\s*\{([\s\S]*?)\}/)
  assert.ok(m, '打印样式缺少 .as-ref-text 覆盖规则')
  assert.match(m[1], /text-overflow:\s*clip\s*!important/, '必须把 ellipsis 关掉,否则仍是「江苏...」')
  assert.match(m[1], /overflow:\s*visible\s*!important/)
  // ⚠ nowrap 不能再出现:它一旦生效会把换行压掉,文字只能溢出到隔壁列(「供应商窜出去了」)
  assert.match(m[1], /white-space:\s*normal\s*!important/,
    '必须允许换行;若保持 nowrap,长供应商名会窜出格子')
  assert.ok(!/white-space:\s*nowrap\s*!important/.test(m[1]), '打印态不得强制 nowrap')
})

test('六格等宽:供应商/采购单号/产品名称 与 总数量/不合格品数量/不合格品比例 列宽一致', () => {
  const rows = qcSheetCfgs.QC_TC_IN.rows.filter((r) => Array.isArray(r.cells) && r.cells.length === 3)
  assert.ok(rows.length >= 2, 'QC_TC_IN 应有两条三格并列行')
  const key = (r) => r.cells.map((c) => `${c.labelW}/${c.flex}`).join('|')
  const first = key(rows[0])
  for (const r of rows) {
    assert.equal(key(r), first, `「${r.cells.map((c) => c.label).join('/')}」列宽与首行不一致`)
  }
  // 同一行内三格也必须一致(用户 2026-10-28:「这六个并列的占位应该一致」)
  for (const c of rows[0].cells) {
    assert.equal(c.labelW, rows[0].cells[0].labelW, '同一行三格的标签宽必须相同')
    assert.equal(c.flex, rows[0].cells[0].flex, '同一行三格的值区宽必须相同')
  }
})

test('纸面整体成页:分页守卫存在', () => {
  const rule = qcPrintRule()
  assert.match(rule, /break-inside:\s*avoid\s*!important/)
  assert.match(rule, /page-break-inside:\s*avoid\s*!important/)
})

// ── 不良说明(2026-10-28 用户口径)────────────────────────────────────────────
// 用户原话:「不要加高行高,只需要可以多行文本就行,最多就用到两行」+「内容多时自动缩字号以装下两行」
// 演变:① 单行 el-input ⇒ 长文本横向截断(残句);② 加高到 150px ⇒ 被用户否掉(不要加高行高)
test('不良说明:行高保持原图 63px 不变(用户明确不要加高)', () => {
  const row = qcSheetCfgs.QC_TC_IN.rows.find((r) => r.cells?.some((c) => c.label === '不良说明'))
  assert.ok(row, 'QC_TC_IN 里找不到「不良说明」行')
  assert.equal(row.h, 63, '行高必须保持 63px —— 用户口径「不要加高行高」')
})

test('不良说明:是多行文本且限制最多两行(fitLines=2)', () => {
  const cell = qcSheetCfgs.QC_TC_IN.rows
    .flatMap((r) => r.cells || []).find((c) => c.label === '不良说明')
  assert.ok(cell, '找不到「不良说明」单元格')
  assert.equal(cell.kind, 'textarea', '必须是多行文本,否则长文本又被单行截断')
  assert.equal(cell.fitLines, 2, '必须声明 fitLines=2(最多两行)')
})

test('不良说明:只读/打印态的字号按字数自适应 + line-clamp 兜底', () => {
  // 模板里必须把 fitFontSize 绑到只读文本的 fontSize 上
  assert.match(VUE, /fontSize:\s*fitFontSize\(/, '模板必须用 fitFontSize 计算字号')
  assert.match(VUE, /as-ro-fit/, '只读文本必须带 as-ro-fit 类(用于 line-clamp)')
  // 函数与常量存在
  assert.match(VUE, /const FIT_FONT_SIZES\s*=\s*\[/, '缺少字号档位常量')
  assert.match(VUE, /function fitFontSize\s*\(/, '缺少 fitFontSize 实现')
  // CSS 兜底:line-clamp 用变量控制行数
  assert.match(VUE, /-webkit-line-clamp:\s*var\(--fit-lines,\s*2\)/, '缺少 line-clamp 兜底')
  assert.match(VUE, /\.as-ro-text\.as-ro-fit\s*\{/, '缺少 .as-ro-fit 样式块')
})

test('不良说明:字号估算用实测标定值(0.78,而非 1:1)', () => {
  // 2026-10-28 浏览器实测:14px 汉字实际宽 10.925px ≈ 0.78 × 字号。
  // 若按 1:1 估,会严重低估容量、把字号降得过小。
  const m = VUE.match(/FIT_CHAR_RATIO\s*=\s*([\d.]+)/)
  assert.ok(m, '缺少 FIT_CHAR_RATIO 常量')
  const ratio = Number(m[1])
  assert.ok(ratio > 0.7 && ratio < 0.9, `字号换算系数应为约 0.78(实测值),实际 ${ratio}`)
  assert.match(VUE, /FIT_AVAIL_W\s*=\s*545/, '可用宽应取实测值 545px')
})

test('只作用于 QC 表格单,RD 系列(1242 设计宽)不被误伤', () => {
  const i = VUE.indexOf('@media print')
  const block = VUE.slice(i)
  const m = block.match(/body\.approval-printing \.approval-sheet:has\(\.q-vrows\)\s*\{/)
  assert.ok(m, '选择器必须用 QC 版式独有的 .q-vrows 作判据(RD 系列走 as-no/as-name,不会命中)')
  // RD 系列没有 vcell ⇒ 不产生 q-vrows ⇒ 不会被这条规则命中
  assert.ok(!JSON.stringify(qcSheetCfgs.RD_APPROVAL || {}).includes('vcell'),
    'RD_APPROVAL 不应被并入 qcSheetCfgs')
})

test('QC 各单(尤其特采单)确实走 q-vrows 分支', () => {
  const tcin = qcSheetCfgs.QC_TC_IN
  assert.ok(tcin, '缺少 QC_TC_IN 版式配置')
  const hasVcellRows = tcin.rows.some((r) => r.vcell !== undefined)
  assert.ok(hasVcellRows, 'QC_TC_IN 必须有带 vcell 的 pairs 行,否则渲染不出 .q-vrows,定宽规则会失效')
})
