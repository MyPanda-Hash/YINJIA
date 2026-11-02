/**
 * 从 DocSheet.vue 源码精确推算 QC_TC_IN 纸面在**打印**下的高度
 * 依据:@page margin 8mm、A4、纸面 width:100%(打印态)、行高给的是 minHeight
 */
const MM = 3.7795275591
const A4_W = 210 * MM, A4_H = 297 * MM
const MARGIN = 8 * MM
const PRINT_W = A4_W - MARGIN * 2   // 733.2
const PRINT_H = A4_H - MARGIN * 2   // 1062.0

console.log('打印可打印区: %.1f × %.1f px', PRINT_W, PRINT_H)

// ── 纸面结构(自上而下)──
// 1) 顶栏:公司名 + 单据编号(as-topbar)
// 2) 标题行(as-title-row, 内含 .as-title)
// 3) 信息表(as-info-table):3 行(使用范围/责任部门/时间)
// 4) 附件行
// 5) 表体 rows
// 6) 落款

// 从 CSS 推断的固定高度(px)
const PARTS = [
  ['顶栏(公司+单号)', 34],
  ['标题行(特采申请单)', 56],
  ['信息表 3 行 × ~28', 84],
  ['附件行', 26],
]
const bodyRows = [
  ['供应商/采购单号/产品名称', 52],
  ['总数量/不合格品数量/不合格品比例', 63],
  ['不良说明', 63],
  ['严重程度', 61],
  ['特采理由', 185],
  ['章节:一．相关部门处理意见', 34],
  ['产品开发部意见', 225],
  ['品质部意见', 124],
  ['销售部意见', 122],
  ['研发意见', 92],
  ['章节:二．最终处理结果', 36],
  ['最终处理结果勾选', 71],
]
const totalBody = bodyRows.reduce((s, r) => s + r[1], 0)
const totalFixed = PARTS.reduce((s, r) => s + r[1], 0)
const FOOTER = 34

let acc = 0
console.log('\n=== 结构逐项(打印态,纸面宽 = 可打印宽 733px)===')
for (const [k, h] of PARTS) { acc += h; console.log(`   ${k.padEnd(34)} ${String(h).padStart(4)}  (累计 ${acc})`) }
for (const [k, h] of bodyRows) { acc += h; console.log(`   ${k.padEnd(34)} ${String(h).padStart(4)}  (累计 ${acc})`) }
acc += FOOTER
console.log(`   ${'底部落款'.padEnd(34)} ${String(FOOTER).padStart(4)}  (累计 ${acc})`)

console.log('\n=== 结论 ===')
console.log(`   纸面总高 ${acc}px,可打印高 ${PRINT_H.toFixed(0)}px`)
const overflow = acc - PRINT_H
console.log(`   ${overflow > 0 ? '❌ 超出 ' + overflow.toFixed(0) + 'px,必须分页' : '✅ 单页可容纳'}`)

// 但真正的元凶:纸面内容是按「表体 447px → 纸面 938px」的比例设计的,
// 而打印时纸面被压到 733px ⇒ 内容宽度不足,文字被 ellipsis 截断
console.log('\n=== 宽度(截断的根因)===')
const DESIGN_W = 938
console.log(`   版式按设计宽 ${DESIGN_W}px 排(供应商列 flex:243 / 采购单号 flex:338 / 产品名称 flex:292)`)
console.log(`   打印纸面宽只有 ${PRINT_W.toFixed(0)}px ⇒ 压缩比 ${(PRINT_W / DESIGN_W * 100).toFixed(0)}%`)
for (const [name, w] of [['供应商值区', 243], ['采购单号值区', 338], ['产品名称值区', 292]]) {
  console.log(`     ${name} 设计 ${w}px → 打印 ${(w * PRINT_W / DESIGN_W).toFixed(0)}px`)
}
console.log('\n   「江苏...」「YJ-2...」正是被压缩后放不下、走 text-overflow:ellipsis 截断的。')
