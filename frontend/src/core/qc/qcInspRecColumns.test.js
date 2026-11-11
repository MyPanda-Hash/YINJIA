import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  QC_INSP_REC_COLUMNS,
  QC_INSP_REC_DETAIL_COLUMNS,
  QC_INSP_REC_HEAD_ROWS,
  QC_INSP_REC_FOOT_ROWS,
  QC_INSP_REC_RESULT_KEYS,
  QC_INSP_REC_DISPOSAL_LIB,
  QC_INSP_REC_VERDICT_LIB,
  QC_INSP_ITEM_LIB,
  exportHeaderRow,
  exportRow,
} from './qcInspRecColumns.js'

/** qc_insp_rec_detail 的元数据列(yj_field place=detail);键必须落在这里,否则保存被静默丢弃。
 *  ⚠ 旧列 `检测结果` 已转历史列(visible=0/hidden=1,整段文字),表体不再用它。 */
const DB_DETAIL_COLUMNS = ['检验项', '检测标准', '检验方法', '结果1', '结果2', '结果3', '结果4', '结果5', '单项判定']

test('每个表体列 key 必须存在于 qc_insp_rec_detail 的元数据列里', () => {
  const bad = QC_INSP_REC_COLUMNS
    .filter((c) => !DB_DETAIL_COLUMNS.includes(c.key))
    .map((c) => `${c.label}(key=${c.key})`)
  assert.deepEqual(bad, [])
  assert.deepEqual([...QC_INSP_REC_DETAIL_COLUMNS], DB_DETAIL_COLUMNS)
})

test('检测结果 = 固定五格:键恰好 结果1..结果5(2026-11-11 用户口径)', () => {
  assert.deepEqual([...QC_INSP_REC_RESULT_KEYS], ['结果1', '结果2', '结果3', '结果4', '结果5'])
  assert.equal(QC_INSP_REC_RESULT_KEYS.length, 5, '必须固定 5 格,多/少都要同步改迁移脚本')
  // 表体列里这五格各占一列,且排在 检测标准 之后、单项判定 之前
  const labels = QC_INSP_REC_COLUMNS.map((c) => c.label)
  assert.deepEqual(labels, ['检验项', '检测标准', '检验方法', '结果1', '结果2', '结果3', '结果4', '结果5', '单项判定'])
  // 老的单列文本 `检测结果` 不得再出现在表体列里(否则纸面上会多出一列旧输入框)
  assert.ok(!labels.includes('检测结果'))
  assert.equal(new Set(labels).size, labels.length, '列名不可重复')
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

test('表尾按模板排成两行两对:检验人|检验结论 / 审核人|处理意见', () => {
  assert.equal(QC_INSP_REC_FOOT_ROWS.length, 2, '两行')
  const labels = QC_INSP_REC_FOOT_ROWS.map((pair) => pair.map((c) => c.label))
  assert.deepEqual(labels, [['检验人', '检验结论'], ['审核人', '处理意见']])
  for (const pair of QC_INSP_REC_FOOT_ROWS) assert.equal(pair.length, 2, '每行两对(左签名 / 右结论)')
  // 检验人=新增时按登录人生成 → 锁定只读
  assert.equal(QC_INSP_REC_FOOT_ROWS[0][0].locked, true)
  // 落库键必须是专属列「表单审核人」:叫「审核人」会被 ButtonService 保存时显式丢弃
  const reviewer = QC_INSP_REC_FOOT_ROWS[1][0]
  assert.equal(reviewer.key, '表单审核人')
  assert.notEqual(reviewer.key, '审核人')
  // 处理意见来自标准库(2026-11-11 用户口径)
  assert.equal(QC_INSP_REC_FOOT_ROWS[1][1].key, '处理意见')
  assert.equal(QC_INSP_REC_DISPOSAL_LIB, 'qc.insp_disposal')
  assert.notEqual(QC_INSP_REC_DISPOSAL_LIB, QC_INSP_ITEM_LIB, '两个标准库互不混用')
  // 检验结论也是标准库(2026-11-11 第二轮:只要 合格/不合格,没有特采)
  assert.equal(QC_INSP_REC_VERDICT_LIB, 'qc.insp_verdict')
  assert.notEqual(QC_INSP_REC_VERDICT_LIB, QC_INSP_REC_DISPOSAL_LIB)
})

test('导出:表头=列显示名(五格各一列),行按列定义取值', () => {
  assert.deepEqual(exportHeaderRow(),
    ['检验项', '检测标准', '检验方法', '结果1', '结果2', '结果3', '结果4', '结果5', '单项判定'])
  assert.deepEqual(exportRow({ 检验项: '外观', 结果1: '无异常', 结果5: '无异常', 单项判定: '合格' }),
    ['外观', undefined, undefined, '无异常', undefined, undefined, undefined, '无异常', '合格'])
  assert.deepEqual(exportRow(null), ['', '', '', '', '', '', '', '', ''])
})

/** 源码级回归:纸张组件必须经 K 常量/RESULT_KEYS 取数键,不得裸写中文列名方括号 */
test('组件源码里取表体列值必须走 K 常量或 RESULT_KEYS', () => {
  const src = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  const bad = []
  for (const c of QC_INSP_REC_COLUMNS) {
    if (new RegExp(`\\[\\s*'${c.label}'\\s*\\]`).test(src)) bad.push(c.label)
  }
  assert.deepEqual(bad, [], `组件里裸写了列名取值,应改为 K 常量: ${bad.join(', ')}`)
})

/** 源码级回归:检测结果必须是**五个固定格子**渲染(不是原来那个自由文本域) */
test('组件按 QC_INSP_REC_RESULT_KEYS 渲染五个格子,且不再用文本域当检测结果', () => {
  const src = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  assert.match(src, /QC_INSP_REC_RESULT_KEYS/, '五格键必须来自 qcInspRecColumns 的唯一真源')
  assert.match(src, /v-for="k in RESULT_KEYS"/, '表体检测结果必须按 5 个键循环出格子')
  assert.match(src, /v-for="\(k, gi\) in RESULT_KEYS"/, '表头第二行必须标出 1..5')
  assert.match(src, /colspan="5"/, '表头「检测结果」必须跨 5 列')
  // 原来那一格是 type="textarea" + maxlength="500" 的自由文本域;五格是单值输入
  assert.ok(!/type="textarea"[\s\S]{0,200}maxlength="500"/.test(src),
    '检测结果的自由文本域应已换成五个单值格子')
})

/** 源码级回归:「处理意见」必须走标准库下拉 + 两个必填星号(2026-11-11 用户口径) */
test('处理意见 = 标准库下拉,且检验结论/处理意见/单项判定带必填标记', () => {
  const src = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  assert.match(src, /DISPOSAL_KEY = '处理意见'/, '处理意见键要单列常量')
  assert.match(src, /disposalOptions = computed\(\(\) => optionsOf\(DISPOSAL_KEY\)\)/,
    '处理意见候选必须取字段 options(标准库下发的)')
  assert.match(src, /el-select[\s\S]{0,200}?v-if="editable && cell\.key === DISPOSAL_KEY"/, '处理意见要渲染成下拉')
  assert.match(src, /openStdLib\(DISPOSAL_LIB, '处理意见'\)/, '处理意见要有自己的标准库维护入口')
  assert.match(src, /openStdLib\(VERDICT_LIB, '检验结论'\)/, '检验结论也要有自己的标准库维护入口')
  // 检验结论候选只来自标准库(合格/不合格):不得再写死「特采」选项
  assert.ok(!/el-option[^>]*特采/.test(src), '检验结论候选中不得再写死「特采」选项')
  assert.match(src, /isRequired\(K\.JUDGE\)/, '单项判定要显示必填星号')
  // 新建行必须把必填列建成空串,否则服务端"只校验带键的行"会放行
  assert.match(src, /function blankRow\(\)[\s\S]{0,120}\[K\.ITEM\]: ''[\s\S]{0,60}\[K\.JUDGE\]: ''/,
    '新增行要把 检验项/检测标准/单项判定 的键建出来(空串),必填才拦得住')
})
