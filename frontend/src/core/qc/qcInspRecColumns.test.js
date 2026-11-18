import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  QC_INSP_REC_COLUMNS,
  QC_INSP_REC_DETAIL_COLUMNS,
  QC_INSP_REC_HEAD_ROWS,
  QC_INSP_REC_FOOT_ROWS,
  QC_INSP_REC_RESULT_KEYS,
  QC_INSP_REC_RESULT_COUNT_KEY,
  QC_INSP_REC_MAX_RESULT_COLS,
  QC_INSP_REC_MIN_RESULT_COLS,
  QC_INSP_REC_DEFAULT_RESULT_COLS,
  clampResultColCount,
  activeResultKeys,
  columnsForResultCount,
  QC_INSP_REC_DISPOSAL_LIB,
  QC_INSP_REC_VERDICT_LIB,
  QC_INSP_ITEM_LIB,
  exportHeaderRow,
  exportRow,
} from './qcInspRecColumns.js'

/** qc_insp_rec_detail 的元数据列(yj_field place=detail);键必须落在这里,否则保存被静默丢弃。
 *  ⚠ 旧列 `检测结果` 已转历史列(visible=0/hidden=1,整段文字),表体不再用它。
 *  ⚠ 结果1..结果20 是 2026-11-19「可增删列」的物理列(结果1..5 建于 2026-11-11,6..20 建于 11-19)。 */
const DB_DETAIL_COLUMNS = [
  '检验项', '检测标准', '检验方法',
  ...Array.from({ length: 20 }, (_, i) => `结果${i + 1}`),
  '单项判定',
]

test('每个表体列 key 必须存在于 qc_insp_rec_detail 的元数据列里', () => {
  const bad = QC_INSP_REC_COLUMNS
    .filter((c) => !DB_DETAIL_COLUMNS.includes(c.key))
    .map((c) => `${c.label}(key=${c.key})`)
  assert.deepEqual(bad, [])
  assert.deepEqual([...QC_INSP_REC_DETAIL_COLUMNS], DB_DETAIL_COLUMNS)
})

test('检测结果 = 可增删列:键恰好 结果1..结果20(2026-11-19 用户口径「不要固定5格了」)', () => {
  assert.deepEqual([...QC_INSP_REC_RESULT_KEYS],
    Array.from({ length: 20 }, (_, i) => `结果${i + 1}`))
  assert.equal(QC_INSP_REC_RESULT_KEYS.length, QC_INSP_REC_MAX_RESULT_COLS, '键数 = 物理列上限')
  assert.equal(QC_INSP_REC_MAX_RESULT_COLS, 20, '上限 20 —— 改这个数必须同时加物理列 + yj_field 登记')
  assert.equal(QC_INSP_REC_DEFAULT_RESULT_COLS, 5, '默认仍是 5 列(老单据的观感不变)')
  assert.equal(QC_INSP_REC_MIN_RESULT_COLS, 1, '最少 1 列')
  // 表体列里结果列排在 检验方法 之后、单项判定 之前,且逐个一位
  const labels = QC_INSP_REC_COLUMNS.map((c) => c.label)
  assert.deepEqual(labels, DB_DETAIL_COLUMNS)
  // 老的单列文本 `检测结果` 不得再出现在表体列里(否则纸面上会多出一列旧输入框)
  assert.ok(!labels.includes('检测结果'))
  assert.equal(new Set(labels).size, labels.length, '列名不可重复')
  // 计数载体:头字段「结果列数」(qc_insp_rec.结果列数),界面上不显示
  assert.equal(QC_INSP_REC_RESULT_COUNT_KEY, '结果列数')
})

test('列数收敛:clampResultColCount 把外来值夹到 [1,20],非数字回落到默认 5', () => {
  assert.equal(clampResultColCount(8), 8)
  assert.equal(clampResultColCount('12'), 12)
  assert.equal(clampResultColCount(0), QC_INSP_REC_MIN_RESULT_COLS)
  assert.equal(clampResultColCount(-3), QC_INSP_REC_MIN_RESULT_COLS)
  assert.equal(clampResultColCount(999), QC_INSP_REC_MAX_RESULT_COLS)
  assert.equal(clampResultColCount(undefined), QC_INSP_REC_DEFAULT_RESULT_COLS)
  assert.equal(clampResultColCount(''), QC_INSP_REC_DEFAULT_RESULT_COLS)
  assert.equal(clampResultColCount(null), QC_INSP_REC_DEFAULT_RESULT_COLS)
  assert.equal(clampResultColCount('abc'), QC_INSP_REC_DEFAULT_RESULT_COLS)
  // 小数向下取整(后端 int 列不会给小数,但前端手改可能)
  assert.equal(clampResultColCount('7.9'), 7)
})

test('activeResultKeys:按列数取前 n 个键(1..n)', () => {
  assert.deepEqual(activeResultKeys(5), ['结果1', '结果2', '结果3', '结果4', '结果5'])
  assert.deepEqual(activeResultKeys(1), ['结果1'])
  const keys = activeResultKeys(20)
  assert.equal(keys.length, 20)
  assert.equal(keys[19], '结果20')
  // 超界/未传一律收敛(不是抛错):纸面渲染不能因为脏数据整块空白
  assert.equal(activeResultKeys(999).length, 20)
  assert.equal(activeResultKeys(undefined).length, QC_INSP_REC_DEFAULT_RESULT_COLS)
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

test('导出:结果列数跟着该单的列数走(默认 5 列)', () => {
  assert.deepEqual(exportHeaderRow(),
    ['检验项', '检测标准', '检验方法', '结果1', '结果2', '结果3', '结果4', '结果5', '单项判定'])
  assert.deepEqual(exportRow({ 检验项: '外观', 结果1: '无异常', 结果5: '无异常', 单项判定: '合格' }),
    ['外观', undefined, undefined, '无异常', undefined, undefined, undefined, '无异常', '合格'])
  assert.deepEqual(exportRow(null), ['', '', '', '', '', '', '', '', ''])
  // 10 列的单子导出 10 列结果(不多不少,不铺 20 个物理列)
  const head10 = exportHeaderRow(10)
  assert.equal(head10.length, 3 + 10 + 1, '前三列 + 10 个结果列 + 单项判定')
  assert.deepEqual(head10.slice(3, 13), Array.from({ length: 10 }, (_, i) => `结果${i + 1}`))
  assert.deepEqual(exportRow({ 结果10: 'OK' }, 10).slice(3, 13),
    [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'OK'])
  // 列定义与列数一致
  assert.equal(columnsForResultCount(7).length, 3 + 7 + 1)
  assert.equal(columnsForResultCount(7).filter((c) => c.result).length, 7)
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

/**
 * 源码级回归:检测结果是**可增删列**(2026-11-19),不再是固定五格:
 *   · 表头 colspan 与渲染循环都必须跟着 resultColCount / resultKeys 走;
 *   · 加列/减列入口必须有**看得见**的按钮(表头「＋ 新增列」+ 增行条「＋ 新增检测结果列」),
 *     2026-11-19 第二轮用户报「怎么还是这样」—— 只有分区条里 16px 的 ＋ 时他找不到入口;
 *   · 每列表头要能 × 掉**指定那一列**(只留 －/＋ 删不了中间列);
 *   · 减列/删列都要清空被减列(否则库里留着看不见的旧值,下次加列"自己长回来")。
 */
test('组件按 结果列数 渲染 1..n 个格子(可增删列),不再是固定五格', () => {
  const src = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  assert.match(src, /QC_INSP_REC_RESULT_KEYS/, '结果列键必须来自 qcInspRecColumns 的唯一真源')
  assert.match(src, /QC_INSP_REC_RESULT_COUNT_KEY/, '列数载体必须来自唯一真源')
  assert.match(src, /v-for="k in resultKeys"/, '表体检测结果必须按 1..n 个键循环出格子')
  assert.match(src, /v-for="\(k, gi\) in resultKeys"/, '表头第二行必须标出 1..n')
  assert.match(src, /:colspan="resultColCount"/, '表头「检测结果」必须跨 n 列')
  assert.ok(!/colspan="5"/.test(src), '固定五格的 colspan="5" 必须已去掉')
  // 步进器(加列/减列)
  assert.match(src, /setResultColCount\(resultColCount \+ 1\)/, '分区条要有「增加列」入口')
  assert.match(src, /setResultColCount\(resultColCount - 1\)/, '分区条要有「减少列」入口')
  assert.match(src, /props\.head\[RESULT_COUNT_KEY\] = n/, '列数要写进头字段(否则保存后丢失)')
  assert.match(src, /clearResultColumn\(props\.head, cur, n\)/, '减列要清空被减列已填的值')
  // 2026-11-19 第二轮:看得见的加列入口(表头 + 增行条)与每列 × 删除
  assert.match(src, /class="qr-addcol no-print"/, '表头「检测结果」里要有加列按钮')
  assert.match(src, /tt\('新增检测结果列'\)/, '增行条要有「＋ 新增检测结果列」大按钮')
  assert.match(src, /function addResultColumn\(\)/, '加列要收敛到 addResultColumn(到上限只提示)')
  assert.match(src, /removeResultColumnAt\(gi\)/, '每列表头的 × 要能删掉指定那一列')
  assert.match(src, /function removeResultColumnAt/, '删列逻辑要在(右侧各列左移 + 末列清空)')
  assert.match(src, /row\[RESULT_KEYS\[i\]\] = row\[RESULT_KEYS\[i \+ 1\]\]/, '删中间列要把右侧各列左移')
  // 原来那一格是 type="textarea" + maxlength="500" 的自由文本域;格子是单值输入
  assert.ok(!/type="textarea"[\s\S]{0,200}maxlength="500"/.test(src),
    '检测结果的自由文本域应已换成 1..n 个单值格子')
  // 列多了要能横向滚动,不能被纸面宽度挤掉
  assert.match(src, /class="qr-table-scroll"/, '表体要套横向滚动容器')
})

/** 源码级回归:「处理意见」必须走标准库下拉 + 两个必填星号(2026-11-11 用户口径) */
test('处理意见 = 标准库下拉,且检验结论/处理意见/单项判定带必填红星', () => {
  const src = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  assert.match(src, /DISPOSAL_KEY = '处理意见'/, '处理意见键要单列常量')
  assert.match(src, /disposalOptions = computed\(\(\) => optionsOf\(DISPOSAL_KEY\)\)/,
    '处理意见候选必须取字段 options(标准库下发的)')
  assert.match(src, /el-select[\s\S]{0,200}?v-if="editable && cell\.key === DISPOSAL_KEY"/, '处理意见要渲染成下拉')
  assert.match(src, /openStdLib\(DISPOSAL_LIB, '处理意见'\)/, '处理意见要有自己的标准库维护入口')
  assert.match(src, /openStdLib\(VERDICT_LIB, '检验结论'\)/, '检验结论也要有自己的标准库维护入口')
  // 检验结论候选只来自标准库(合格/不合格):不得再写死「特采」选项
  assert.ok(!/el-option[^>]*特采/.test(src), '检验结论候选中不得再写死「特采」选项')
  // 2026-11-17 用户口径「必填要标红。之前的标红也没了」⇒ 红星画回来(2026-11-13 曾只去视觉)。
  assert.match(src, /isRequired\(K\.JUDGE\)/, '单项判定要显示必填红星')
  assert.match(src, /class="qr-req"/, '必填红星 span 要在')
  assert.match(src, /\.qr-req\s*\{[\s\S]{0,80}color:/, 'CSS 里要有红色')
  // 新建行必须把必填列建成空串,否则服务端"只校验带键的行"会放行
  assert.match(src, /function blankRow\(\)[\s\S]{0,120}\[K\.ITEM\]: ''[\s\S]{0,60}\[K\.JUDGE\]: ''/,
    '新增行要把 检验项/检测标准/单项判定 的键建出来(空串),必填才拦得住')
})

/**
 * 2026-11-12 用户口径:「检验项现在是带入的,不需要标准库维护」
 * ⇒ 检验项列头的「⧉ 标准库维护」入口必须摘掉;检验结论/处理意见两处保留。
 */
test('检验项列不再挂「标准库维护」入口(检验项改为带入),检验结论/处理意见仍保留', () => {
  const src = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  assert.ok(!/openStdLib\(\)/.test(src), '检验项那处 openStdLib() 无参调用必须已摘掉')
  assert.ok(!/QC_INSP_ITEM_LIB/.test(src), '组件不应再导入检验项标准库(仅保留 检验结论/处理意见 两处)')
  assert.match(src, /openStdLib\(VERDICT_LIB, '检验结论'\)/, '检验结论的标准库维护入口要保留')
  assert.match(src, /openStdLib\(DISPOSAL_LIB, '处理意见'\)/, '处理意见的标准库维护入口要保留')
})
