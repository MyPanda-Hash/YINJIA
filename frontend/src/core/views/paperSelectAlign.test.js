/**
 * 纸面下拉选中值的垂直对齐（2026-11-23 用户报障：
 *   「项目实施计划的保密等级与项目定级的显示的字歪了」）。
 *
 * 根因（生产实测）：Element Plus 把选中值 `.el-select__placeholder` 设成 position:absolute，
 *   它不参与格子的文档流与行高 ⇒ 在固定行高的纸面格里，实测比 wrapper 顶边**高 6px**，
 *   字就压在边框上。这与 2026-11-19 烧结清单那次是同一个毛病，但当时的修复只作用于
 *   RecordSheetPanels 的 `td.rs-td`，DocSheet（`.as-*` 结构）吃不到。
 *
 * 修复口径：纸面下拉的占位符改 static，交给 wrapper 的 flex 居中。
 * 已实测：注入同一份 CSS 后 off 由 −6px → +1/+2px（截图核对，密级/项目定级均归位）。
 * 覆盖面（本轮实测）：DocSheet 的两张纸有该问题（立项申请·密级 1 处、实施计划·密级+项目定级 2 处）；
 *   DataRecordSheet（功能性滤效，5 个下拉）与 QcInspRecSheet（2 个）实测 **0 处**偏移，不动。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const docSheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const record = readFileSync(new URL('./DataRecordSheet.vue', import.meta.url), 'utf8')
const qcRec = readFileSync(new URL('./QcInspRecSheet.vue', import.meta.url), 'utf8')

const ruleFor = (sel) => {
  const i = docSheet.indexOf(sel)
  assert.ok(i >= 0, `缺规则 ${sel}`)
  return docSheet.slice(i, docSheet.indexOf('}', i))
}

test('DocSheet 纸面下拉：占位符回到文档流（static），wrapper 垂直居中', () => {
  const ph = ruleFor('.approval-sheet :deep(.as-info-value .el-select__placeholder)')
  assert.match(ph, /position:\s*static/, '必须 static —— EP 默认 absolute 会浮在格子上方 6px')
  const wrap = ruleFor('.approval-sheet :deep(.as-info-value .el-select__wrapper)')
  assert.match(wrap, /min-height:\s*0/, 'wrapper 不能有 28px 最小高（纸面格只有 23~31px）')
  assert.match(wrap, /align-items:\s*center/, '要由 wrapper 负责垂直居中')
  const row = ruleFor('.approval-sheet :deep(.as-fill .el-select__placeholder)')
  assert.match(row, /position:\s*static/)
})

test('修复必须同时覆盖「右上信息表」与「正文行」两个落点', () => {
  assert.match(docSheet, /\.as-info-value \.el-select__placeholder/)
  assert.match(docSheet, /\.as-fill \.el-select__placeholder/)
})

test('实测无问题的两个纸面不要被顺手改（避免回归）', () => {
  // 这两个组件本轮实测 0 处偏移；若将来它们也出现，再按同一口径补，不要提前改
  assert.ok(!/el-select__placeholder[^}]*position:\s*static/.test(record), 'DataRecordSheet 本轮不动')
  assert.ok(!/el-select__placeholder[^}]*position:\s*static/.test(qcRec), 'QcInspRecSheet 本轮不动')
})
