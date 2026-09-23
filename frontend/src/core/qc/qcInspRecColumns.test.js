import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  QC_INSP_REC_COLUMNS,
  QC_INSP_REC_DETAIL_COLUMNS,
  QC_INSP_REC_HEAD_ROWS,
  QC_INSP_REC_FOOT_FULL,
  QC_INSP_REC_SIGN_ROW,
  QC_INSP_ITEM_LIB,
  exportHeaderRow,
  exportRow,
} from './qcInspRecColumns.js'

/** qc_insp_rec_detail 的元数据列(yj_field place=detail);键必须落在这里,否则保存被静默丢弃 */
const DB_DETAIL_COLUMNS = ['检验项', '检测标准', '检测结果', '单项判定']

test('每个表体列 key 必须存在于 qc_insp_rec_detail 的元数据列里', () => {
  const bad = QC_INSP_REC_COLUMNS
    .filter((c) => !DB_DETAIL_COLUMNS.includes(c.key))
    .map((c) => `${c.label}(key=${c.key})`)
  assert.deepEqual(bad, [])
  assert.deepEqual([...QC_INSP_REC_DETAIL_COLUMNS], DB_DETAIL_COLUMNS)
})

test('表体四列一比一:检验项 | 检测标准 | 检测结果 | 单项判定', () => {
  assert.deepEqual(QC_INSP_REC_COLUMNS.map((c) => c.label), ['检验项', '检测标准', '检测结果', '单项判定'])
  assert.equal(new Set(QC_INSP_REC_COLUMNS.map((c) => c.label)).size, 4)
})

test('检验项挂在标准库 qc.insp_item(原表「检验项为数据库选择」)', () => {
  assert.equal(QC_INSP_ITEM_LIB, 'qc.insp_item')
  const item = QC_INSP_REC_COLUMNS.find((c) => c.label === '检验项')
  assert.equal(item.lib, QC_INSP_ITEM_LIB)
})

test('抬头四行成对(左标签-右值),与 Excel 模版一致', () => {
  assert.equal(QC_INSP_REC_HEAD_ROWS.length, 4)
  const flat = QC_INSP_REC_HEAD_ROWS.flat().map((c) => c.label)
  assert.deepEqual(flat, [
    '物料名称', '来料日期', '物料编码', '来料数量',
    '物料批次', '文件编码', '检验日期', '检验依据',
  ])
  for (const row of QC_INSP_REC_HEAD_ROWS) assert.equal(row.length, 2, '每行两对')
  // 物料批次=回填字段(入库审核时才分配批次号并回填)→ 不可编辑(纸面显示为文本)
  const batchCell = QC_INSP_REC_HEAD_ROWS.flat().find((c) => c.key === '物料批次')
  assert.equal(batchCell.locked, true, '物料批次由回填得到 → 锁定只读')
  // 其余抬头字段仍可填(不要顺手把所有抬头都锁了)
  assert.equal(QC_INSP_REC_HEAD_ROWS[0][0].locked, undefined, '物料名称可填')
})

test('表尾:检验结论/处理意见整宽 + 签名行(检验人锁定、审核人走专属列)', () => {
  assert.deepEqual(QC_INSP_REC_FOOT_FULL.map((c) => c.label), ['检验结论', '处理意见'])
  assert.deepEqual(QC_INSP_REC_SIGN_ROW.map((c) => c.label), ['检验人', '审核人'])
  assert.equal(QC_INSP_REC_SIGN_ROW[0].locked, true, '检验人=账号登录人自动生成 → 锁定')
  assert.ok(!QC_INSP_REC_SIGN_ROW[1].locked, '审核人可填(默认 固定:冯敏)')
  // 落库键必须是专属列「表单审核人」:叫「审核人」会被 ButtonService 保存时显式丢弃
  assert.equal(QC_INSP_REC_SIGN_ROW[1].key, '表单审核人')
  assert.notEqual(QC_INSP_REC_SIGN_ROW[1].key, '审核人')
})

test('导出:表头=列显示名,行按列定义取值', () => {
  assert.deepEqual(exportHeaderRow(), ['检验项', '检测标准', '检测结果', '单项判定'])
  assert.deepEqual(exportRow({ 检验项: '外观', 单项判定: '合格' }), ['外观', undefined, undefined, '合格'])
  assert.deepEqual(exportRow(null), ['', '', '', ''])
})

/** 源码级回归:纸张组件必须经 K 常量取数键,不得裸写中文列名方括号 */
test('组件源码里取表体列值必须走 K 常量', () => {
  const src = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  const bad = []
  for (const c of QC_INSP_REC_COLUMNS) {
    if (new RegExp(`\\[\\s*'${c.label}'\\s*\\]`).test(src)) bad.push(c.label)
  }
  assert.deepEqual(bad, [], `组件里裸写了列名取值,应改为 K 常量: ${bad.join(', ')}`)
})
