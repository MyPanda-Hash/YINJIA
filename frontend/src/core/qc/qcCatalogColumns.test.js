import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  QC_CATALOG_COLUMNS,
  QC_CATALOG_DETAIL_COLUMNS,
  QC_CATALOG_GROUP_KEYS,
  QC_CATALOG_HEADER_GROUPS,
  QC_CATALOG_REQUIRED_KEYS,
  exportHeaderRow,
  exportRow,
} from './qcCatalogColumns.js'

/**
 * 守的线:控制列表的每一列 key 必须落在 qc_catalog_detail 的元数据列里
 * (yj_field where panel_code='QC_CATALOG' and place='detail')。
 * 项目进度查询当年就是因为"显示名当数据键",保存时被后端按元数据静默丢弃。
 */
test('每个列 key 必须存在于 qc_catalog_detail 的元数据列里', () => {
  const bad = QC_CATALOG_COLUMNS
    .filter((c) => !QC_CATALOG_DETAIL_COLUMNS.includes(c.key))
    .map((c) => `${c.label}(key=${c.key})`)
  assert.deepEqual(bad, [], `以下列的落库键不在 yj_field 里,保存会被丢弃:\n  ${bad.join('\n  ')}`)
})

test('表格一比一 + 联动列:9 列,顺序=类别/名称/编码/批次号/数量/检验状态/是否合格/检验单号/检验数据记录单号', () => {
  assert.deepEqual(QC_CATALOG_COLUMNS.map((c) => c.label), [
    '检测物料类别', '物料名称', '物料编码', '批次号', '数量', '检验状态', '是否合格',
    '检验单号', '检验数据记录单号',
  ])
  assert.equal(new Set(QC_CATALOG_COLUMNS.map((c) => c.label)).size, 9)
})

test('表头分组:只保留「检验记录目录」分组(第1/2/3类 层级标签行已按用户口径删除)', () => {
  assert.deepEqual(QC_CATALOG_HEADER_GROUPS.map((g) => g.label), ['检验记录目录'])
  const span = QC_CATALOG_HEADER_GROUPS.reduce((n, g) => n + g.span, 0)
  assert.equal(span, 6, '检验记录目录覆盖其后六列')
  // 该分组覆盖的六列(含两个挂靠单号)
  const third = QC_CATALOG_COLUMNS.filter((c) => c.group === '检验记录目录')
  assert.deepEqual(third.map((c) => c.label), ['批次号', '数量', '检验状态', '是否合格', '检验单号', '检验数据记录单号'])
  // 物料层三列各有自己的列名(不再依赖 第1类/第2类)
  assert.deepEqual(QC_CATALOG_COLUMNS.slice(0, 3).map((c) => c.label), ['检测物料类别', '物料名称', '物料编码'])
  assert.ok(QC_CATALOG_COLUMNS.slice(0, 3).every((c) => !c.group), '物料层三列不挂在分组下')
})

test('分组列 = 前两列(合并单元格);必填列 = 类别/物料名称/批次号(与 yj_field required 一致)', () => {
  assert.deepEqual([...QC_CATALOG_GROUP_KEYS], ['检测物料类别', '物料名称'])
  assert.deepEqual([...QC_CATALOG_REQUIRED_KEYS], ['检测物料类别', '物料名称', '批次号'])
  for (const k of QC_CATALOG_REQUIRED_KEYS) {
    assert.ok(QC_CATALOG_DETAIL_COLUMNS.includes(k), `${k} 必须是明细列`)
  }
})

test('导出:表头=列显示名,行取值按列定义', () => {
  assert.deepEqual(exportHeaderRow(), ['检测物料类别', '物料名称', '物料编码', '批次号', '数量', '检验状态', '是否合格', '检验单号', '检验数据记录单号'])
  const row = { 检测物料类别: '折叠棉', 物料名称: 'HP-12', 物料编码: 'Y-ZDM-001', 批次号: '260807', 数量: '51Kg' }
  assert.deepEqual(exportRow(row), ['折叠棉', 'HP-12', 'Y-ZDM-001', '260807', '51Kg', undefined, undefined, undefined, undefined])
  assert.deepEqual(exportRow(null), ['', '', '', '', '', '', '', '', ''])
})

/**
 * 源码级回归:控制列表组件必须经 K 常量取数键,不得裸写中文列名字符串索引。
 * (本表 label 与 key 同名,裸写不会立刻出错,但一旦改名就会静默丢库 —— 提前钉住。)
 */
test('组件源码里取列值必须走 K 常量(不得裸写列名方括号)', () => {
  const src = readFileSync(new URL('../views/QcCatalogSheet.vue', import.meta.url), 'utf8')
  const bad = []
  for (const c of QC_CATALOG_COLUMNS) {
    if (new RegExp(`\\[\\s*'${escapeRe(c.label)}'\\s*\\]`).test(src)) bad.push(c.label)
  }
  assert.deepEqual(bad, [], `组件里裸写了列名取值,应改为 K 常量: ${bad.join(', ')}`)
  // K 常量必须覆盖全部 6 列
  for (const c of QC_CATALOG_COLUMNS) {
    assert.ok(new RegExp(`${c.label}`).test(src), `组件里应出现 ${c.label}`)
  }
})

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
