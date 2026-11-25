/**
 * qcProcInspSheetLayout.test.js —— 出货检验纸面(YJ-QR-154)「批次号可见 + 五列一套居中口径」钉子
 *
 * 【2026-11-25 用户报障】「填写时无异常,填写完成后不仅不显示批次号,各行的格式还不一样」
 *   (单据 ZJ-2026-11-0015,出货检验（表观）QC_ASM_INSP,已审核态截图)
 *
 *   根因(实测复现,证据见 tools/archive/_ship-insp-layout-20261125/):
 *     ① 表头「批次号」格只有 `v-if="editable"` 的改名输入框,**没有只读分支** ——
 *        提交审批/审核通过后 editable=false,整列只剩「批次号」三个字,
 *        批号 20281117 在纸面上彻底消失(而导出 Excel 的表头还印着「批次号：20281117」)。
 *     ② 同一张纸四套对齐口径:检验项目居中、检验方法/检验要求左对齐(行高 17px)、
 *        批次号列体「编辑态左对齐 / 只读态居中」、判定居中(行高 normal)
 *        ⇒ 填写时与填写完成后是两个样子,用户眼里就是「各行的格式还不一样」。
 *
 * 【2026-11-25 用户口径】「表格需实现可手动换行,且格式一致居中」
 *   ⇒ 五个数据列一套口径:居中 + 行高 18px + 顶对齐;手工换行(Enter,落库 \n)
 *     在录入态(textarea)与只读态(.qr-cell-text pre-wrap)都保留。
 *
 * 单测跑不了布局,按仓库既有做法读源码钉住(同 qcProcInspItemWrap.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sheet = readFileSync(new URL('./QcProcInspSheet.vue', import.meta.url), 'utf8')

/** 取出表头「批次号」格(<th class="c-batchname"> … </th>) */
function batchHeadCell() {
  const m = sheet.match(/<th class="c-batchname">[\s\S]*?<\/th>/)
  assert.ok(m, '找不到表头批次号格(<th class="c-batchname">)')
  return m[0]
}
/** 取出五列统一口径的样式块 */
function fiveColsCss() {
  const m = sheet.match(/\.qr-grid td\.c-item,\r?\n\.qr-grid td\.c-mtd,[\s\S]*?\n\}/)
  assert.ok(m, '找不到「五个数据列一套口径」样式块')
  return m[0]
}

test('① 只读态(提交/审核后)批次号必须显示 —— 表头格要有 v-else 批号文本分支', () => {
  const cell = batchHeadCell()
  assert.match(cell, /<div v-if="editable" class="qr-batch-edit">/, '改名输入框要包在可编辑分支里')
  assert.match(cell, /v-else class="qr-batch-value"[^>]*>\{\{ b \}\}<\/span>/,
    '只读态必须渲染批号文本 —— 否则审批通过后整列只剩「批次号」三个字(本次报障根因)')
  // 旧写法(输入框自带 v-if、没有只读分支)不许回来
  assert.doesNotMatch(cell, /<el-input\s+v-if="editable"[\s\S]*?<\/th>/,
    '输入框又退回「自带 v-if 且无 v-else」的写法了(批号会在只读态再次消失)')
  // 删批次 × 只在可编辑分支内(已在 div v-if 里,不该再判 editable)
  assert.doesNotMatch(cell, /v-if="editable && batches\.length > 1"/,
    '× 已在 editable 分支内,重复判 editable 是旧写法的痕迹')
})

test('② 只读批号文本样式:居中 + 手工换行(pre-wrap)', () => {
  const m = sheet.match(/\.qr-batch-value \{[\s\S]*?\n\}/)
  assert.ok(m, '找不到 .qr-batch-value 样式')
  assert.match(m[0], /text-align: center/)
  assert.match(m[0], /white-space: pre-wrap/, '批号里若有换行也要留得住')
})

test('③ 五个数据列一套口径:居中 + 行高 18px + 顶对齐', () => {
  const css = fiveColsCss()
  for (const cls of ['c-item', 'c-mtd', 'c-req', 'c-batchtext', 'c-result']) {
    assert.ok(css.includes(`.qr-grid td.${cls}`), `统一口径里缺 ${cls} 列`)
  }
  assert.match(css, /text-align: center/)
  assert.match(css, /line-height: 18px/)
  assert.match(css, /vertical-align: top/)
  // 方法/要求列的左对齐口径不许回来
  assert.doesNotMatch(sheet, /\.qr-grid td\.c-mtd,\r?\n\.qr-grid td\.c-req \{\r?\n  text-align: left/,
    '检验方法/检验要求又单独左对齐了 —— 会重新出现「各行格式不一样」')
})

test('④ 录入态与只读态同一对齐:textarea 居中、.qr-cell-text 居中且 pre-wrap', () => {
  const wrap = sheet.match(/\.qr-cell-wrap :deep\(\.el-textarea__inner\) \{[\s\S]*?\n\}/)
  assert.ok(wrap, '找不到 .qr-cell-wrap 的 textarea 样式')
  assert.match(wrap[0], /text-align: center/, '录入态 textarea 必须与只读态一样居中')
  const text = sheet.match(/\.qr-cell-text \{[\s\S]*?\n\}/)
  assert.ok(text, '找不到 .qr-cell-text 样式')
  assert.match(text[0], /text-align: center/)
  assert.match(text[0], /white-space: pre-wrap/, '只读态必须保留手工换行(Enter 落库的 \\n)')
  assert.match(text[0], /line-height: 18px/, '只读态行高要与录入态一致')
  // 判定下拉选中文字也居中(下拉默认左对齐)
  assert.match(sheet, /\.el-select__selected-item\) \{\r?\n  text-align: center;/)
})

test('⑤ 抬头/表尾格子不受影响(本次只动明细矩阵)', () => {
  const m = sheet.match(/\.qr-value \{[\s\S]*?\n\}/)
  assert.ok(m, '找不到抬头/表尾值格样式')
  assert.match(m[0], /text-align: left/, '抬头/表尾的值格保持左对齐(不是明细格)')
})
