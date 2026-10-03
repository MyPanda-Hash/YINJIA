/**
 * prodDocSearch 单测 —— 产品文件列表(RD_PROD_DOCLIST)**矩阵行**的搜索口径。
 *
 * 【为什么单独一个模块】该面板是「单单据 + 矩阵」:库里只有 1 张单据(PDL-0001),
 * 真正的内容是表格里的**产品行**(产品编号 × 4 个文件 × 状态)。侧栏的模糊搜索/查询单据/单据预览
 * 原先都是在对那 1 张单据做文档查询 ⇒ 用户看到的就是「搜索不可用」(2026-09-30 用户反馈)。
 * 改成对矩阵行筛选后,判定必须能在 node --test 下断言(与后端无关、纯客户端),故抽到这里。
 *
 * 字段口径(与界面上那个字段下拉一一对应):
 *   · 产品编号 / 是否受控 / 受控日期 → 该列内容包含关键字(忽略大小写)
 *   · 状态（任一文件）             → 4 个文件里**任一**状态包含关键字(如填「未开发」找没做的文件)
 *   · 任意字段(ALL_FIELDS)         → 以上任一命中即算命中
 * 多条件之间是 AND;同字段填多行时后一行覆盖前一行(与文书侧栏 buildFuzzyQuery 同口径)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_FIELDS } from '../search/fuzzyQuery.js'
import {
  PROD_DOC_STATUS_FIELD,
  PROD_DOC_FIELD_OPTIONS,
  buildProdDocFilter,
  matchProdDocRow,
  filterProdDocRows,
} from './prodDocSearch.js'

const COLS = [
  { panelCode: 'RD_SPEC_DOC', panelName: '规格书' },
  { panelCode: 'RD_MOLD_PROC', panelName: '成型工艺清单' },
  { panelCode: 'RD_ASM_PROC', panelName: '组装工艺清单' },
  { panelCode: 'RD_INSP_PLAN', panelName: '出货检验计划表' },
]
const row = (no, cells, extra = {}) => ({ 产品编号: no, cells, ...extra })
const ROWS = [
  row('DEMO-A-001', { RD_SPEC_DOC: '开发完毕', RD_MOLD_PROC: '开发完毕', RD_ASM_PROC: '开发完毕', RD_INSP_PLAN: '开发完毕' }, { 是否受控: '是', 受控日期: '2026-09-21' }),
  row('DEMO-B-001', { RD_SPEC_DOC: '开发完毕', RD_MOLD_PROC: '未开发', RD_ASM_PROC: '开发中', RD_INSP_PLAN: '未开发' }, { 是否受控: '否', 受控日期: '' }),
  row('C-95-33', { RD_SPEC_DOC: '开发审核中', RD_MOLD_PROC: '未开发', RD_ASM_PROC: '未开发', RD_INSP_PLAN: '未开发' }, { 是否受控: '否', 受控日期: '' }),
]

test('字段下拉 = 产品编号 / 是否受控 / 受控日期 / 状态（任一文件）', () => {
  assert.deepEqual(PROD_DOC_FIELD_OPTIONS, ['产品编号', '是否受控', '受控日期', PROD_DOC_STATUS_FIELD])
})

test('条件构建:空行忽略;有值即可用;同字段后者覆盖前者', () => {
  assert.equal(buildProdDocFilter([]).valid, false)
  assert.equal(buildProdDocFilter([{ field: '', value: '' }]).valid, false)
  assert.equal(buildProdDocFilter([{ field: '产品编号', value: '' }]).valid, false)
  const f = buildProdDocFilter([{ field: '产品编号', value: ' DEMO ' }, { field: '产品编号', value: 'DEMO-A' }])
  assert.equal(f.valid, true)
  assert.deepEqual(f.conditions, [{ field: '产品编号', value: 'DEMO-A' }])
})

test('产品编号:包含匹配(忽略大小写)', () => {
  const f = buildProdDocFilter([{ field: '产品编号', value: 'demo-a' }])
  assert.deepEqual(filterProdDocRows(ROWS, COLS, f).map((r) => r.产品编号), ['DEMO-A-001'])
})

test('状态（任一文件）:4 个文件里任一状态命中即算命中', () => {
  const f = buildProdDocFilter([{ field: PROD_DOC_STATUS_FIELD, value: '未开发' }])
  assert.deepEqual(filterProdDocRows(ROWS, COLS, f).map((r) => r.产品编号), ['DEMO-B-001', 'C-95-33'])
  const f2 = buildProdDocFilter([{ field: PROD_DOC_STATUS_FIELD, value: '开发审核中' }])
  assert.deepEqual(filterProdDocRows(ROWS, COLS, f2).map((r) => r.产品编号), ['C-95-33'])
})

test('是否受控 / 受控日期:按该列内容匹配', () => {
  assert.deepEqual(filterProdDocRows(ROWS, COLS, buildProdDocFilter([{ field: '是否受控', value: '是' }])).map((r) => r.产品编号), ['DEMO-A-001'])
  assert.deepEqual(filterProdDocRows(ROWS, COLS, buildProdDocFilter([{ field: '受控日期', value: '2026-09' }])).map((r) => r.产品编号), ['DEMO-A-001'])
})

test('任意字段:以上任一列命中即算命中', () => {
  const f = buildProdDocFilter([{ field: ALL_FIELDS, value: 'C-95' }])
  assert.deepEqual(filterProdDocRows(ROWS, COLS, f).map((r) => r.产品编号), ['C-95-33'])
  const f2 = buildProdDocFilter([{ field: ALL_FIELDS, value: '开发中' }])
  assert.deepEqual(filterProdDocRows(ROWS, COLS, f2).map((r) => r.产品编号), ['DEMO-B-001'])
})

test('多条件 AND', () => {
  const f = buildProdDocFilter([
    { field: PROD_DOC_STATUS_FIELD, value: '未开发' },
    { field: '是否受控', value: '否' },
    { field: '产品编号', value: 'DEMO-B' },
  ])
  assert.deepEqual(filterProdDocRows(ROWS, COLS, f).map((r) => r.产品编号), ['DEMO-B-001'])
})

test('未给条件时原样返回(不是清空)', () => {
  assert.equal(filterProdDocRows(ROWS, COLS, null).length, 3)
  assert.equal(filterProdDocRows(ROWS, COLS, { valid: false, conditions: [] }).length, 3)
  assert.equal(filterProdDocRows(null, COLS, null).length, 0)
})

test('cells 缺失/字段为空时不抛错(历史行可能只有部分面板)', () => {
  const rows = [{ 产品编号: 'X-1' }, { 产品编号: 'X-2', cells: null }]
  assert.equal(matchProdDocRow(rows[0], COLS, buildProdDocFilter([{ field: PROD_DOC_STATUS_FIELD, value: '未开发' }])), false)
  assert.doesNotThrow(() => filterProdDocRows(rows, COLS, buildProdDocFilter([{ field: ALL_FIELDS, value: 'X' }])))
  assert.deepEqual(filterProdDocRows(rows, COLS, buildProdDocFilter([{ field: '产品编号', value: 'x-2' }])).map((r) => r.产品编号), ['X-2'])
})
