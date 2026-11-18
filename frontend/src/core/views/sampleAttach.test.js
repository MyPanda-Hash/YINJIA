/**
 * 外部-开发样品单「附件」行（2026-11-18 用户口径，Excel #8）：
 *   「在期望交期页面后面做个位置，可以添加附件（图片或 PDF 或者 Word 文档）」
 *   并确认**只加在这张单**（内部开发 / 非开发样品单都不加）。
 *
 * 契约：
 *   · 只有 sampleExtSheetCfg 声明 `attach`，sampleNdSheetCfg（展开继承）必须显式置空；
 *   · DocSheet 的表格式纸面要真的渲染这一行（信息条下面、跨满列宽），并用通用 FileAttachCell；
 *   · 元数据侧：头表有 `附件` 列 + yj_field 一行（data_type='附件'），且另外两张样品单没有该字段。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sampleExtSheetCfg, sampleNdSheetCfg } from './docSheetConfigs.js'
import { sampleIntSheetCfg } from './docSheetConfigs.js'

const vue = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const mig = readFileSync(new URL('../../../../tools/migrate-sample-ext-attach-20261118.sql', import.meta.url), 'utf8')

test('只有外部-开发样品单声明附件行', () => {
  assert.deepEqual(sampleExtSheetCfg.attach, { label: '附件', key: '附件' })
  assert.equal(sampleNdSheetCfg.attach, null, '非开发样品单必须显式关掉（它是展开继承 EXT 的）')
  assert.ok(!sampleIntSheetCfg.attach, '内部开发样品单不挂附件')
})

test('DocSheet 表格式纸面渲染附件行：信息条之后、跨满列宽、走 FileAttachCell', () => {
  const at = vue.indexOf('<tr v-if="gridAttach"')
  assert.ok(at > 0, '缺附件行模板')
  const seg = vue.slice(at, at + 700)
  assert.match(seg, /:colspan="gridCols\.length"/, '要跨满整行，否则线框断开')
  assert.match(seg, /<FileAttachCell/, '必须复用通用附件组件')
  assert.match(seg, /:can-edit="attachCanEdit"/, '可编辑性走 attachCanEdit（不是 editable）')
  // 附件行必须在表头行**之前**（= 信息条下面、"期望交期后面"）
  const headRow = vue.indexOf('<tr class="sg-head-row">')
  assert.ok(at < headRow, '附件行要排在表头行之前')
  assert.match(vue, /const gridAttach = computed\(/, '缺 gridAttach 计算属性')
})

test('元数据迁移：加 附件 列 + yj_field 一行，且不扩散到另两张样品单', () => {
  assert.match(mig, /ADD \[附件\] nvarchar\(500\) NULL/, '头表要加附件列')
  assert.match(mig, /INSERT INTO yj_field[\s\S]{0,400}N'RD_SAMPLE_EXT', N'附件', N'附件', N'附件'/, '要插 附件 字段行')
  assert.match(mig, /RD_SAMPLE_INT', 'RD_SAMPLE_ND'/, '自检要盯住另两张样品单没有该字段')
})
