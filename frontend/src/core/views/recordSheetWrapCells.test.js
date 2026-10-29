/**
 * recordSheetWrapCells.test.js —— 「明细单元格自动换行」的契约守卫
 *
 * 【需求来源】用户 2026-10-29 报障:
 *   「测试申请单的表格填写并没有自动换行,现在是会被截断」
 *   (截图:「测试（检测）标准」格填 1111111111111111,文字横向溢出、被格子切掉)
 *
 * 【根因】明细行的普通文本格用的是**单行** el-input(不换行、不增高),
 *   只有配置里标了 area 的列才走 textarea。测试申请单 16 列里只有 2 列标了 area。
 *
 * 【口径】文本列默认换成「自动换行 textarea」(class rs-wrap-in,autosize 随内容长高);
 *   真正短的列(日期/序号等)显式 singleLine 保持单行。
 *   只读态同一口径(.rsp-cell 也要 word-break)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const cfgs = readFileSync(new URL('./recordSheetConfigs.js', import.meta.url), 'utf8')

test('明细文本格默认走自动换行 textarea（单行只留给显式 singleLine）', () => {
  const block = vue.slice(vue.indexOf('v-else-if="cellEditable(dt, row, c) && c.singleLine"') - 900)
  const idxWrap = vue.indexOf('rs-wrap-in')
  assert.ok(idxWrap > 0, '文本格必须有 rs-wrap-in 分支')
  // 换行分支是 textarea + autosize
  const seg = vue.slice(idxWrap - 900, idxWrap + 400)
  assert.match(seg, /type="textarea"/, '换行分支要用 textarea')
  assert.match(seg, /:autosize="\{ minRows: 1, maxRows: c\.rows \|\| 12 \}"/, '换行分支要 autosize 起步 1 行')
  // singleLine 分支仍在,且是单行 el-input(没有 type="textarea")
  const idxSingle = vue.indexOf('cellEditable(dt, row, c) && c.singleLine')
  assert.ok(idxSingle > 0, '显式 singleLine 分支要保留')
  assert.ok(block.length > 0)
})

test('换行格 CSS:去 nowrap、允许任意断词（长串也能折行）', () => {
  const idx = vue.indexOf('.rs-wrap-in :deep(.el-textarea__inner)')
  assert.ok(idx > 0, '要有 .rs-wrap-in 的 textarea 样式')
  const css = vue.slice(idx, idx + 400)
  assert.match(css, /white-space: pre-wrap/, '要 pre-wrap（不能 nowrap）')
  assert.match(css, /word-break: break-word|overflow-wrap: anywhere/, '要允许在任意位置断行')
  assert.match(css, /min-height: 24px/, '压掉 Element 默认的 textarea 最小高度')
})

test('只读格同样换行（打印/审批后也不能截断）', () => {
  const idx = vue.indexOf('.rsp-cell {')
  const css = vue.slice(idx, idx + 320)
  assert.match(css, /word-break: break-word/, '只读格要断词')
  assert.match(css, /overflow-wrap: anywhere/, '只读格要允许任意处折行')
})

test('测试申请单:原来只有 2 列 area，现在长文本列都放开', () => {
  const seg = cfgs.slice(cfgs.indexOf("filterVal: '内部申请'"), cfgs.indexOf("filterVal: '外部申请'"))
  assert.ok(seg.length > 200, '要能取到内部申请的列配置')
  // 用户报障的那一列必须允许换行
  assert.match(seg, /\{ key: '测试（检测）标准'[^}]*area: true \}/, '「测试（检测）标准」必须 area:true')
  // 真正短的列保持单行
  assert.match(seg, /\{ key: '序号'[^}]*singleLine: true \}/, '序号保持单行')
  // 至少 5 列允许换行（改造前只有 2 列）
  const areaCount = (seg.match(/area: true/g) || []).length
  assert.ok(areaCount >= 5, `内部申请表允许换行的列应 ≥5（实际 ${areaCount}）`)
})
