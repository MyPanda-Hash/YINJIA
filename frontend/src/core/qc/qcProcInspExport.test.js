/**
 * qcProcInspExport 单测 —— 出货检验功能记录表(YJ-QR-154)→ Excel 的版式单一真源。
 *
 * 【这条为什么必须自动化守】用户 2026-11-11 口径「将当前的出货检验列表的格式修改为图2所示的形式」:
 * 图2 = 《出货检验功能记录表》= 标题 + 表单编号 + 抬头 3 行 2 组 + 「检验明细」矩阵
 * (检验项目|检验方法|检验要求 + 每批「批次号|本批结果判断」两列)+ 表尾 2 行 2 组。
 * 版式一旦散在组件里就会与纸面漂移,所以这里钉住:
 *   ① 批次列清单(batchListOf:内部批次清单 CSV 优先,旧单回退单批);
 *   ② 明细行聚合(aggregateInspItems:一行一个检验项目,结果按批次摊开);
 *   ③ aoa 骨架 / 列宽 / 合并区(含"不写 1×1 合并区")。
 * 这里只测纯数组与合并区(不碰 xlsx),组件那层只做 aoa_to_sheet + writeFile。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  PROC_INSP_TITLE,
  PROC_INSP_FORM_CODE,
  PROC_INSP_HEAD_DEFS,
  PROC_INSP_FOOT_DEFS,
  PROC_INSP_BASE_COLS,
  PROC_INSP_BATCH_COLS,
  batchListOf,
  aggregateInspItems,
  buildProcInspExport,
} from './qcProcInspExport.js'

const headPairs = [
  [{ label: '单据编号', value: 'ZC-2026-11-0001' }, { label: '检测周期', value: '2026-11-05 ~ 2026-11-11' }],
  [{ label: '产品编码', value: 'S032-3' }, { label: '工单号', value: 'WO-2026-11-0001' }],
  [{ label: '产品型号', value: '28*12*178' }, { label: '抽检方案', value: 'Y料成品检验方案' }],
]
/** 已聚合形态(组件口径):一行一个检验项目,结果按批次号摊开 */
const itemRows = [
  { 检验项目: '外观', 检验方法: '目视', 检验要求: '无破损、无变形', 结果: { '261105': '合格', '261107': '不合格' } },
  { 检验项目: '尺寸', 检验方法: '卡尺', 检验要求: '28±0.5mm', 结果: { '261105': '合格', '261107': '合格' } },
]
const foot = [
  { label: '检验人', value: '张三' },
  { label: '检验结论', value: '合格' },
  { label: '审核人', value: '冯敏' },
  { label: '处理意见', value: '允收' },
]
const batches2 = ['261105', '261107']

const build2 = () => buildProcInspExport({
  title: PROC_INSP_TITLE,
  subtitle: '惠州市银嘉环保科技有限公司　　单据编号：ZC-2026-11-0001　　单据状态：草稿',
  headPairs,
  batches: batches2,
  rows: itemRows,
  foot,
})

/* ══════════════════════════ ① 批次列清单 ══════════════════════════ */

test('batchListOf:优先「内部批次清单」CSV(去空白/去重/兼容中文逗号),旧单回退单批', () => {
  // 设计 §二:清单 = 英文逗号分隔,保证「先加批次、后带入检验项目」列不丢
  assert.deepEqual(batchListOf({ 内部批次清单: '261105,261107,261108' }), ['261105', '261107', '261108'])
  assert.deepEqual(batchListOf({ 内部批次清单: ' 261105 , 261105 ,,261107 ' }), ['261105', '261107'])
  // 手填的中文逗号/分号也别把整串当一批
  assert.deepEqual(batchListOf({ 内部批次清单: '261105，261107' }), ['261105', '261107'])
  assert.deepEqual(batchListOf({ 内部批次清单: '261105;261107' }), ['261105', '261107'])
  // 清单空 ⇒ 旧单单批:头「批次号」,连它都空则「本批」
  assert.deepEqual(batchListOf({ 内部批次清单: '', 批次号: '20261014' }), ['20261014'])
  assert.deepEqual(batchListOf({ 批次号: '  ' }), ['本批'])
  assert.deepEqual(batchListOf({}), ['本批'])
  assert.deepEqual(batchListOf(), ['本批'])
})

/* ══════════════════════════ ② 明细行聚合 ══════════════════════════ */

test('aggregateInspItems:原始行表(检验项目 × 内部批次)按项目聚合,结果落对应批次', () => {
  const raw = [
    { 检验项目: '外观', 检验方法: '目视', 检验要求: '无破损', 内部批次: '261105', 结果判断: '合格' },
    { 检验项目: '外观', 检验方法: '目视', 检验要求: '无破损', 内部批次: '261107', 结果判断: '不合格' },
    { 检验项目: '尺寸', 检验方法: '卡尺', 检验要求: '28±0.5mm', 内部批次: '261105', 结果判断: '合格' },
    { 检验项目: '尺寸', 检验方法: '卡尺', 检验要求: '28±0.5mm', 内部批次: '261107', 结果判断: '合格' },
  ]
  const out = aggregateInspItems(raw, batches2)
  assert.equal(out.length, 2)                                          // 两行 = 两个检验项目
  assert.deepEqual(out.map((it) => it['检验项目']), ['外观', '尺寸'])     // 顺序 = 首次出现顺序
  assert.equal(out[0]['检验方法'], '目视')
  assert.equal(out[0]['检验要求'], '无破损')
  assert.deepEqual(out[0]['结果'], { '261105': '合格', '261107': '不合格' })
  assert.deepEqual(out[1]['结果'], { '261105': '合格', '261107': '合格' })
})

test('aggregateInspItems:旧单行(无「内部批次」)落首列批次;已聚合形态原样收下', () => {
  // 旧单:明细「内部批次」空 ⇒ 单批列,批次号取头「批次号」= batches[0]
  const legacy = aggregateInspItems([{ 检验项目: '外观', 检验要求: '无破损', 结果判断: '合格' }], ['20261014'])
  assert.deepEqual(legacy, [{
    检验项目: '外观', 检验方法: '', 检验要求: '无破损',
    结果: { '20261014': '合格' }, 结果文本: { '20261014': '' },
  }])
  // 已聚合(带「结果」对象):不再二次聚合(结果文本缺省补空对象)
  const done = aggregateInspItems(itemRows, batches2)
  assert.deepEqual(done, itemRows.map((it) => ({ ...it, 结果文本: {} })))
  assert.deepEqual(aggregateInspItems(undefined, batches2), [])
})

/* ══════════════════════════ ③ 骨架 / 列宽 / 合并区(2 批次 = 7 列) ══════════════════════════ */

test('图2 骨架:标题+表单编号 / 抬头 3 行 2 组 / 检验明细矩阵 / 表尾 2 行 2 组', () => {
  const out = build2()
  const { aoa, cols, merges, headerRow1, headerRow2, titleRow, subtitleRow, headRows, firstDataRow, lastDataRow, footRows } = out
  const N = 3 + 2 * 2
  assert.equal(out.colCount, N)
  assert.equal(out.batchNames.length, 2)
  assert.equal(cols.length, N)
  // 行索引:标题 0 / 副标题 1 / 抬头 2-4 / 「检验明细」5 / 列标签 6 / 数据 7-8 / 表尾 9-10
  assert.equal(titleRow, 0)
  assert.equal(subtitleRow, 1)
  assert.deepEqual(headRows, [2, 3, 4])
  assert.equal(headerRow1, 5)
  assert.equal(headerRow2, 6)
  assert.equal(firstDataRow, 7)
  assert.equal(lastDataRow, 8)
  assert.deepEqual(footRows, [9, 10])
  assert.equal(aoa.length, 11)
  assert.equal(headerRow2, headerRow1 + 1)

  // r0 标题 + 右上「表单编号：YJ-QR-154」(标题让出最后两列)
  assert.equal(aoa[0][0], '出货检验功能记录表')
  assert.equal(aoa[0][5], '表单编号：YJ-QR-154')
  assert.equal(aoa[0].length, N)
  assert.ok(merges.some((m) => m.s.r === 0 && m.s.c === 0 && m.e.r === 0 && m.e.c === N - 3), '标题跨到表单编号左侧')
  assert.ok(merges.some((m) => m.s.r === 0 && m.s.c === N - 2 && m.e.r === 0 && m.e.c === N - 1), '表单编号跨最后两列')
  // r1 副标题整行合并
  assert.ok(/单据编号/.test(aoa[1][0]))
  assert.ok(merges.some((m) => m.s.r === 1 && m.s.c === 0 && m.e.c === N - 1))

  // r2..r4 抬头 3 行 × 2 组(单据编号|检测周期、产品编码|工单号、产品型号|抽检方案)
  const headLabels = headRows.map((r) => [aoa[r][0], aoa[r][3]])
  assert.deepEqual(headLabels, [['单据编号', '检测周期'], ['产品编码', '工单号'], ['产品型号', '抽检方案']])
  assert.deepEqual(headRows.map((r) => aoa[r][1]), ['ZC-2026-11-0001', 'S032-3', '28*12*178'])
  assert.deepEqual(headRows.map((r) => aoa[r][4]), ['2026-11-05 ~ 2026-11-11', 'WO-2026-11-0001', 'Y料成品检验方案'])
  for (const r of headRows) {
    assert.ok(merges.some((m) => m.s.r === r && m.s.c === 1 && m.e.c === 2), `抬头第 ${r} 行组 1 值跨 2 列`)
    assert.ok(merges.some((m) => m.s.r === r && m.s.c === 4 && m.e.c === N - 1), `抬头第 ${r} 行组 2 值跨余下列`)
  }

  // headerRow1 = 「检验明细」区块标题(整行合并)
  assert.equal(aoa[headerRow1][0], '检验明细')
  assert.ok(merges.some((m) => m.s.r === headerRow1 && m.s.c === 0 && m.e.c === N - 1))

  // headerRow2 = 检验项目|检验方法|检验要求 + 每批两列(批号写在第一列表头「批次号：<批号>」|本批结果判断)
  assert.deepEqual(aoa[headerRow2],
    ['检验项目', '检验方法', '检验要求', '批次号：261105', '本批结果判断', '批次号：261107', '本批结果判断'])

  // 数据行:一行一个检验项目;每批两格 = 录入对应结果(实测数值,本用例没有 ⇒ 空) + 本批结果判断
  assert.deepEqual(aoa[firstDataRow], ['外观', '目视', '无破损、无变形', '', '合格', '', '不合格'])
  assert.deepEqual(aoa[lastDataRow], ['尺寸', '卡尺', '28±0.5mm', '', '合格', '', '合格'])
  // 数据区不做跨列/跨行合并(每批两列各占一格)
  assert.equal(merges.filter((m) => m.s.r >= firstDataRow && m.e.r <= lastDataRow).length, 0)

  // 表尾 2 行 × 2 组
  assert.deepEqual(aoa[footRows[0]], ['检验人', '张三', '', '检验结论', '合格', '', ''])
  assert.deepEqual(aoa[footRows[1]], ['审核人', '冯敏', '', '处理意见', '允收', '', ''])
  for (const r of footRows) {
    assert.ok(merges.some((m) => m.s.r === r && m.s.c === 1 && m.e.c === 2), '表尾组 1 值跨 2 列')
    assert.ok(merges.some((m) => m.s.r === r && m.s.c === 4 && m.e.c === N - 1), '表尾组 2 值跨余下列(结论格横跨)')
  }

  // 列宽:3 个固定列 + 每批两列
  assert.deepEqual(cols.slice(0, 3).map((c) => c.wch), PROC_INSP_BASE_COLS.map((c) => c.wch))
  assert.equal(cols[3].wch, PROC_INSP_BATCH_COLS[0].wch)
  assert.equal(cols[4].wch, PROC_INSP_BATCH_COLS[1].wch)
  assert.equal(cols[6].wch, PROC_INSP_BATCH_COLS[1].wch)
})

/* ══════════════════════════ ④ 旧单回退单批(5 列)+ 从 head 取默认值 ══════════════════════════ */

test('旧单(无批次清单)= 单批次列:批次号取头「批次号」,结果取行「结果判断」,抬头/表尾从 head 取值', () => {
  const head = {
    单据编号: 'ZC-2026-10-0021',
    检测周期: '2026-10-15 ~ 2026-10-17',
    产品编码: 'S032-3',
    工单号: 'WO-2026-10-0007',
    规格型号: '28*12*178',
    检验方案: 'Y料成品检验方案',
    批次号: '20261014',
    检验员: 'admin',
    总结论: '合格',
    表单审核人: '冯敏',
    处理方式: '照常流转',
  }
  const out = buildProcInspExport({
    head,
    // 旧单明细行:没有 内部批次,只有 结果判断(行表历史数据原样)
    rows: [{ 检验项目: '外观', 检验方法: '目视', 检验要求: '无破损', 结果判断: '合格' }],
  })
  const { aoa, cols, merges, headerRow2, firstDataRow } = out
  assert.equal(out.colCount, 5)                       // 3 + 2 × 1 批
  assert.equal(cols.length, 5)
  assert.deepEqual(out.batchNames, ['20261014'])
  assert.equal(out.batchCount, 1)

  // 标题仍留出表单编号两列(默认 YJ-QR-154)
  assert.equal(aoa[0][0], PROC_INSP_TITLE)
  assert.equal(aoa[0][3], `表单编号：${PROC_INSP_FORM_CODE}`)
  // 抬头 3 行:不传 headPairs 时按 PROC_INSP_HEAD_DEFS 从 head 取(型号→规格型号、抽检方案→检验方案)
  assert.deepEqual(PROC_INSP_HEAD_DEFS.map((p) => p.map((d) => d.label)),
    [['单据编号', '检测周期'], ['产品编码', '工单号'], ['产品型号', '抽检方案']])
  assert.deepEqual(out.headRows.map((r) => aoa[r][1]), ['ZC-2026-10-0021', 'S032-3', '28*12*178'])
  assert.deepEqual(out.headRows.map((r) => aoa[r][4]),
    ['2026-10-15 ~ 2026-10-17', 'WO-2026-10-0007', 'Y料成品检验方案'])

  // 单批次列:批号在表头「批次号：20261014」;数据格 = 录入对应结果(空) + 结果判断
  assert.deepEqual(aoa[headerRow2], ['检验项目', '检验方法', '检验要求', '批次号：20261014', '本批结果判断'])
  assert.deepEqual(aoa[firstDataRow], ['外观', '目视', '无破损', '', '合格'])

  // 表尾:不传 foot 时按 PROC_INSP_FOOT_DEFS 从 head 取(审核人 = head「表单审核人」)
  assert.deepEqual(PROC_INSP_FOOT_DEFS.map((d) => d.label), ['检验人', '检验结论', '审核人', '处理意见'])
  assert.deepEqual(aoa[out.footRows[0]], ['检验人', 'admin', '', '检验结论', '合格'])
  assert.deepEqual(aoa[out.footRows[1]], ['审核人', '冯敏', '', '处理意见', '照常流转'])

  // 5 列时组 2 的值只有 1 列 ⇒ 不写 1×1 合并区
  assert.ok(!merges.some((m) => m.s.r === m.e.r && m.s.c === m.e.c))
})

/* ══════════════════════════ ⑤ 空单 / 空批次 / 默认值 ══════════════════════════ */

test('空单也铺一行空表体;无批次/无头 ⇒ 单批「本批」;空 formCode 时标题占满全宽', () => {
  const out = buildProcInspExport({ rows: [] })
  const { aoa, headerRow2, firstDataRow, lastDataRow, footRows } = out
  assert.equal(out.colCount, 5)
  assert.deepEqual(out.batchNames, ['本批'])
  // 空单:一行空表体(批号只印在表头,数据格留空供手填;导出的表可继续手填)
  assert.equal(lastDataRow, firstDataRow)
  assert.deepEqual(aoa[firstDataRow], ['', '', '', '', ''])
  assert.equal(aoa[headerRow2].length, 5)
  assert.equal(aoa[headerRow2][3], '批次号：本批')
  // 表尾仍在最后两行,且只有 2 行
  assert.deepEqual(footRows, [aoa.length - 2, aoa.length - 1])
  // 不印表单编号 ⇒ 标题整行合并
  const noCode = buildProcInspExport({ formCode: '', rows: [] })
  assert.equal(noCode.aoa[0][0], PROC_INSP_TITLE)
  assert.ok(noCode.merges.some((m) => m.s.r === 0 && m.s.c === 0 && m.e.c === noCode.colCount - 1))
  assert.equal(noCode.aoa[0].filter((v) => String(v).startsWith('表单编号')).length, 0)
})

/* ══════════════════════════ ⑥ 合并区卫生 + 纯函数约束 ══════════════════════════ */

test('合并区:全部落在表格内、无 1×1;长文本原样进格(不截断)', () => {
  const long = '1.称取100g Y料成品，从上到下依次放20目、325目筛网进行震动筛分，称量各目数占比并记录；'.repeat(3)
  const out = buildProcInspExport({
    headPairs,
    batches: ['A', 'B', 'C'],
    rows: [{ 检验项目: '外观', 检验方法: long, 检验要求: long, 结果: { A: '合格' } }],
    foot,
  })
  const { aoa, merges, colCount } = out
  assert.equal(colCount, 3 + 2 * 3)                    // 9 列
  for (const m of merges) {
    assert.ok(m.s.r <= m.e.r && m.s.c <= m.e.c, '合并区左上/右下顺序')
    assert.ok(!(m.s.r === m.e.r && m.s.c === m.e.c), '不该有 1×1 合并区')
    assert.ok(m.e.r < aoa.length && m.e.c < colCount, '合并区不越界')
    assert.ok(m.s.r >= 0 && m.s.c >= 0)
  }
  // 长文本原样进单元格(换行交给 Excel 的 wrapText)
  assert.equal(aoa[out.firstDataRow][1], long)
  assert.equal(aoa[out.firstDataRow][2], long)
  // C 批没有录入结果/判定 ⇒ 两个格都是空串(不写 undefined);批号在表头
  assert.equal(aoa[out.firstDataRow][7], '')
  assert.equal(aoa[out.firstDataRow][8], '', 'C 批没有结果 ⇒ 空串不写 undefined')
  assert.equal(aoa[out.headerRow2][3], '批次号：A')
  assert.equal(aoa[out.headerRow2][8], '本批结果判断')
})

test('纯函数:模块不 import xlsx(组件那层才做 aoa_to_sheet + writeFile)', () => {
  const src = readFileSync(fileURLToPath(new URL('./qcProcInspExport.js', import.meta.url)), 'utf8')
  assert.ok(!/from\s+['"]xlsx['"]/.test(src), '导出模块不得 import xlsx')
  assert.ok(!/require\(\s*['"]xlsx['"]\s*\)/.test(src))
})
