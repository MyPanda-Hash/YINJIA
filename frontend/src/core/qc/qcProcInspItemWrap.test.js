/**
 * qcProcInspItemWrap.test.js —— 出货检验(功能/表观)纸面「检验项目」长文本必须自动换行
 *
 * 【2026-11-23 用户报障】截图里检验项目列的名目被截断:
 *   「*抗压强度（裸…」「*黑水及颗粒物」只露出前半段 —— 单行 el-input 里的字不会换行,
 *   超出格子就横向滚动,肉眼看就是**显示不完全**。用户口径:「文本显示不完全的内容需要能够自动换行,
 *   检查当前的出货检验（功能）和出货检验（表观)」。
 *
 * 【为什么两张单一起守】功能 QC_PROC_INSP 与表观 QC_ASM_INSP 共用同一个纸面组件
 *   (QcProcInspSheet.vue,见 PanelxList.PROC_INSP_SHEET_PANELS)——改一处两张单同时生效,
 *   所以单测盯住「组件里 检验项目 是换行控件」+「两张单确实共用该组件」两件事。
 *
 * 【判据】
 *   ① 可编辑态:检验项目格是 textarea(autosize),带 qr-cell-wrap —— 单行 input 一定截断;
 *   ② 只读态:退回 .qr-cell-text(本来就 pre-wrap),不许因为改可编辑态把只读态弄丢;
 *   ③ CSS:该 textarea 允许按字符断行(word-break/overflow-wrap),否则 23 字项目名
 *      (如「*整体尺寸 （内PP棉、外包布、套网、打端盖）」)在 9% 窄列里仍会横向溢出;
 *   ④ 两张单的面板代号都在 PROC_INSP_SHEET_PANELS 里(共用纸面)。
 *
 * 单测跑不了布局,按仓库既有做法读源码钉住(同 qcProcInspColWidths.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sheet = readFileSync(new URL('./QcProcInspSheet.vue', import.meta.url), 'utf8')
const list = readFileSync(new URL('../views/PanelxList.vue', import.meta.url), 'utf8')

/** 取出 <td class="c-item"> … </td> 这一段(唯一:检验项目格) */
function itemCellTemplate() {
  const m = sheet.match(/<td class="c-item">[\s\S]*?<\/td>/)
  assert.ok(m, '找不到检验项目单元格模板(<td class="c-item">)')
  return m[0]
}

/** 取出 .qr-grid td.c-item 的 textarea 样式块 */
function itemCellCss() {
  const m = sheet.match(/\.qr-grid td\.c-item \.qr-cell-wrap :deep\(\.el-textarea__inner\) \{[\s\S]*?\n\}/)
  assert.ok(m, '找不到检验项目 textarea 的换行样式块')
  return m[0]
}

test('① 可编辑态:检验项目用多行域(autosize + qr-cell-wrap),不再是单行 input', () => {
  const cell = itemCellTemplate()
  assert.match(cell, /v-if="editable"/)
  assert.match(cell, /type="textarea"/, '检验项目必须是 textarea —— 单行 input 装不下长项目名')
  assert.match(cell, /:autosize="\{ minRows: 1, maxRows: 12 \}"/, '按内容自动增高(空行保持 1 行高)')
  assert.match(cell, /class="qr-cell-input qr-cell-wrap qr-item-input"/, '要带 qr-cell-wrap 才会换行')
  // 旧实现(单行 input + 右侧 size="small" 无 type) 不许回来
  assert.doesNotMatch(cell, /<el-input\s+v-if="editable"\s+:model-value="g\.name"\s+size="small"/,
    '检验项目又退回单行 el-input 了(会重新出现「*抗压强度（裸…」这种截断)')
})

test('② 只读态:仍用 .qr-cell-text 展示(本来就按词换行,不许丢)', () => {
  const cell = itemCellTemplate()
  assert.match(cell, /v-else class="qr-cell-text">\{\{ groupCell\(g, '检验项目'\) \}\}/, '只读态要保留 qr-cell-text')
  const css = sheet.match(/\.qr-cell-text \{[\s\S]*?\n\}/)
  assert.ok(css, '找不到 .qr-cell-text 样式')
  assert.match(css[0], /white-space: pre-wrap/, '只读文本必须 pre-wrap,否则一样会被截')
})

test('③ 样式:检验项目 textarea 居中 + 按字符断行(9% 窄列里 23 字项目名不许横向溢出)', () => {
  const css = itemCellCss()
  assert.match(css, /text-align: center/, '项目名居中(与只读态一致)')
  assert.match(css, /word-break: break-word/)
  assert.match(css, /overflow-wrap: anywhere/)
})

test('④ 出货检验(功能)与出货检验(表观)共用同一张纸面 => 一处修复两张单都生效', () => {
  assert.match(list, /const PROC_INSP_SHEET_PANELS = \['QC_PROC_INSP', 'QC_ASM_INSP'\]/,
    '两张单必须共用 QcProcInspSheet(PROC_INSP_SHEET_PANELS 里两个代号)')
})

test('⑤ 数据格一律顶对齐(批次格不再垂直居中 => 内容不会看着掉到下一行)', () => {
  const m = sheet.match(/\.qr-grid th,\r?\n\.qr-grid td \{[\s\S]*?\r?\n\}/)
  assert.ok(m, '找不到 .qr-grid th/td 基础样式块')
  assert.match(m[0], /vertical-align: top/, '数据格必须顶对齐,否则行高一撑就"内容跑到下面"')
  // 表头仍居中(批次号/检验项目 等表头文字)
  const thead = sheet.match(/\.qr-grid thead th \{[\s\S]*?\r?\n\}/)
  assert.ok(thead, '找不到表头样式块')
  assert.match(thead[0], /vertical-align: middle/, '表头文字保持垂直居中')
  // 批次格不允许再单独写 middle
  assert.doesNotMatch(sheet, /\.qr-grid td\.c-batchtext \{[^}]*vertical-align: middle/)
})
