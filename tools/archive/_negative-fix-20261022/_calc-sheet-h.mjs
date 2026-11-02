/**
 * 计算 QC_TC_IN 版式的纸面总高度,与 A4 可打印高度对比
 * A4 = 210×297mm;打印边距 8mm(@page margin: 8mm)→ 可打印 194×281mm ≈ 732×1061px(@96dpi:1mm=3.7795px)
 */
const MM = 3.7795275591
const A4_W = 210 * MM            // 793.7px
const A4_H = 297 * MM            // 1122.5px
const MARGIN = 8 * MM            // 30.24px
const PRINT_H = A4_H - MARGIN * 2
const PRINT_W = A4_W - MARGIN * 2

// 纸面宽度:版式按原图 938px 等比(见配置注释「表体 x48..495=447px → 纸面 938px」)
const SHEET_W = 938

// QC_TC_IN 的行高(取自 docSheetConfigs.js)
const rows = [
  ['供应商/采购单号/产品名称', 52],
  ['总数量/不合格品数量/不合格品比例', 63],
  ['不良说明', 63],
  ['严重程度', 61],
  ['特采理由', 185],
  ['一．相关部门处理意见(章节)', 34],
  ['产品开发部意见(性能101+工艺124)', 225],
  ['品质部意见', 124],
  ['销售部意见', 122],
  ['研发意见', 92],
  ['二．最终处理结果(章节)', 36],
  ['正常使用/管控使用/挑选使用', 71],
]
const rowsSum = rows.reduce((s, r) => s + r[1], 0)

// 页眉:公司名行 + 标题行 + 信息表(3 行) —— 下面用实测值估算
const HEADER = 34 + 60 + 3 * 28   // 公司条 / 大标题 / 信息表三行
// 底部落款(编制/审核/批准一行)
const FOOTER = 34

const total = HEADER + rowsSum + FOOTER
console.log('=== QC_TC_IN 纸面高度估算 ===')
for (const [k, h] of rows) console.log(`   ${k.padEnd(34)} ${String(h).padStart(4)}px`)
console.log(`   表体行合计                            ${String(rowsSum).padStart(4)}px`)
console.log(`   页眉(公司/标题/信息表)               ${String(HEADER).padStart(4)}px`)
console.log(`   底部落款                              ${String(FOOTER).padStart(4)}px`)
console.log(`   ------------------------------------------------`)
console.log(`   纸面总高                              ${String(total).padStart(4)}px`)

console.log('\n=== 对照 ===')
console.log(`   A4 整页高                        ${A4_H.toFixed(1)}px`)
console.log(`   打印边距 8mm×2 后可打印高        ${PRINT_H.toFixed(1)}px`)
console.log(`   纸面宽 ${SHEET_W}px,可打印宽 ${PRINT_W.toFixed(1)}px`)

// 关键:纸面 938px 宽,打印到 A4 可打印宽 733px ⇒ 浏览器按缩放比 733/938 = 0.781
const scale = PRINT_W / SHEET_W
console.log(`\n   宽度缩放比 = ${(scale * 100).toFixed(1)}%(938px 纸面塞进 ${PRINT_W.toFixed(0)}px 打印宽)`)
const scaledTotal = total * scale
console.log(`   缩放后总高 = ${scaledTotal.toFixed(0)}px vs 可打印高 ${PRINT_H.toFixed(0)}px`)
console.log(`   ⇒ ${scaledTotal > PRINT_H ? '❌ 一页放不下,会分页' : '✅ 一页放得下'}`
  + `(超出 ${(scaledTotal - PRINT_H).toFixed(0)}px,约 ${((scaledTotal - PRINT_H) / PRINT_H * 100).toFixed(1)}%)`)
