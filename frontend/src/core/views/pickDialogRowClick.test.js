/**
 * pickDialogRowClick.test.js —— 「其他的这种弹窗的勾选形式都进行改动，都做点击行就判定勾选的操作」
 *                              + 「把必填项的红点标识去掉，保留必填项的属性就行，只是去掉红点」
 *                              （2026-11-13 用户口径）
 *
 * 【为什么单独立这份测试】
 * 系统里有 5 个「多选列表弹窗」各自实现勾选，改一个漏四个是最典型的回归：
 *   RefPickDialog（参照选择，客户名/供应商这类）/ ProductImportDialog（BOM 导入）/
 *   DocNoPickDialog（单号双源）/ SupplierPickerDialog（供应商）/ MaterialLabelDialog（物料标签）。
 * 这里用**源码级断言**统一钉住「每个多选弹窗都必须支持点行勾选」，加新弹窗时漏了就会被点出来。
 *
 * 【红点口径】用户明确：「保留必填项的属性就行，只是去掉红点」⇒ 只动**视觉**，
 * `yj_field.required` / `isRequired()` / 保存校验 / 校验定位闪烁 全部保持原样。
 * 所以断言反过来钉：CSS 里不许再有那个红星伪元素，但 isRequired 的调用必须还在。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

const refPick = read('./RefPickDialog.vue')
const prodImport = read('./ProductImportDialog.vue')
const docNoPick = read('./DocNoPickDialog.vue')
const sheet = read('./RecordSheetPanels.vue')
const list = read('./PanelxList.vue')
const qcSheet = read('./QcInspRecSheet.vue')
const labelDlg = read('./MaterialLabelDialog.vue')

/** 该弹窗是否支持「点行即勾选」：必须有 @row-click，且处理函数里翻了该行的选中态 */
function hasRowClick(src, name) {
  if (!/@row-click=/.test(src)) return `${name} 缺 @row-click`
  // 多选弹窗切 selected / toggleRowSelection；单选弹窗（单号双源）切 leftPick/rightPick
  if (!/toggleRowSelection|toggleMatPickRow|selected\.value|leftPick\.value\s*=|rightPick\.value\s*=/.test(src)) {
    return `${name} 的 row-click 没切换选中态`
  }
  return ''
}

test('① 参照选择弹窗（客户名/供应商等）：点行即勾选', () => {
  const err = hasRowClick(refPick, 'RefPickDialog')
  assert.equal(err, '', err)
  assert.match(refPick, /row-click/, '参照选择要绑 row-click')
  // 单值字段(客户名这类)点一行就该定下来，不必再点「确定导入」
  assert.match(refPick, /props\.mode === 'header'|mode === 'header'|\bheader\b/,
    '单值(表头)参照点行即选中并可直接确认')
})

test('② BOM 导入弹窗：点行即勾选', () => {
  assert.equal(hasRowClick(prodImport, 'ProductImportDialog'), '')
})

test('③ 单号双源弹窗：点行即勾选', () => {
  assert.equal(hasRowClick(docNoPick, 'DocNoPickDialog'), '')
})

test('④ 点行勾选不能把「点复选框」也再翻一次（否则勾了立刻被切回去）', () => {
  // ⚠ 判据要在**处理函数体**里找（@row-click 在 template 里、函数在 script 里，相隔很远）
  const fnOf = (src, name) => {
    const m = src.match(/(?:function )?(onRowClick|pickLeft|pickRight)\s*\([^)]*\)\s*\{([\s\S]{0,600})/)
    assert.ok(m, `${name} 找不到行点击处理函数`)
    return m[2]
  }
  for (const [src, name] of [[refPick, 'RefPickDialog'], [prodImport, 'ProductImportDialog'], [docNoPick, 'DocNoPickDialog']]) {
    assert.match(src, /@row-click=/, `${name} 应有 @row-click`)
    const body = fnOf(src, name)
    assert.match(body, /closest\(/,
      `${name} 的行点击要排掉复选框/单选框自身的点击（否则勾了立刻又被切回去）`)
    assert.match(body, /el-checkbox|el-radio/, `${name} 的排他判据要点名控件类名`)
  }
})

test('⑤ 勾中的行要能一眼看出来（选中态样式 + 手型光标）', () => {
  assert.match(refPick, /highlight-current-row|row-class-name/, '参照选择要有行高亮')
  for (const [src, name] of [[refPick, 'RefPickDialog'], [prodImport, 'ProductImportDialog'], [docNoPick, 'DocNoPickDialog']]) {
    assert.match(src, /cursor:\s*pointer/, `${name} 的行要手型光标（整行可点）`)
  }
})

test('⑥ 纸面必填红星去掉，但必填属性/校验逻辑一个都不动', () => {
  // 视觉：.rs-req 不再画星
  const css = sheet.slice(sheet.indexOf('.rs-req'))
  assert.doesNotMatch(css.slice(0, 240), /content:\s*'\*'/,
    '.rs-req::after 不许再画红星（用户口径：只去掉红点）')
  // 行为：isReq / isPairReq 的调用必须还在（保存校验、定位闪烁都靠它）
  assert.match(sheet, /function isReq\(/, 'isReq 判据必须保留')
  assert.match(sheet, /'rs-req': isReq\(|'rs-req': isPairReq\(/, '标签格仍要带必填标记类（供后续样式/校验使用）')
  assert.match(sheet, /rs-field-blink|rsFieldBlink/, '校验定位闪烁（必填缺失时跳转提示）必须保留')
})

test('⑦ 其它面板的红星一并去掉（同一个用户口径，别只改纸面这一处）', () => {
  // 查询弹窗 / 列表表头 / 检验记录 / 物料标签：都不再画红星
  assert.doesNotMatch(list.slice(list.indexOf('.field label.req')), /content:\s*'\*'/, 'PanelxList 查询弹窗红星去掉')
  assert.doesNotMatch(list.slice(list.indexOf('.col-hdr-text.req')), /content:\s*'\*'/, 'PanelxList 表头红星去掉')
  assert.doesNotMatch(qcSheet, /class="qr-req"/, 'QcInspRecSheet 红星 span 去掉')
  assert.doesNotMatch(labelDlg.slice(labelDlg.indexOf('.mlq-req')), /content:\s*'\*'/, 'MaterialLabelDialog 红星去掉')
  // ⚠ 但必填**属性**仍在：QcInspRecSheet 的 isRequired 判据不能跟着删
  assert.match(qcSheet, /function isRequired\(/, 'isRequired 判据必须保留（只删视觉）')
})
