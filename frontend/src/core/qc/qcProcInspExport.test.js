/**
 * qcProcInspExport 单测 —— 制程检验单纸面 → Excel 的版式单一真源。
 *
 * 【这条为什么必须自动化守】用户 2026-10-17 口径「同时实现当前可excel导出」:导出的是**当前这张纸**,
 * 版式一旦散在组件里就会与纸面漂移(标题/抬头/表头两行/左侧四列合并/结论区)。
 * 这里只测纯数组与合并区(不碰 xlsx),组件那层只做 aoa_to_sheet + writeFile。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { PROC_INSP_COLS, PROC_INSP_FOOT, buildProcInspExport, leftColValue } from './qcProcInspExport.js'

const head = {
  单据编号: 'ZC-2026-10-0021',
  单据状态: '草稿',
  客户名称: '对应客户项目名称',
  产品编码: 'S032-3',
  规格型号: '28*12*178',
  批次号: '20261014',
  检验员: 'admin',
  总结论: '合格',
  处理方式: '照常流转',
  审核人: '李四',
}
const rows = [
  { 检验要求: '+20目占比≤15%', 检验方法: '1.称取100g Y料成品，从上到下依次放20目、325目筛网进行震动筛分…', 产线常规功能性结果: '13%', 结果判断: '合格' },
  { 检验要求: '-325目占比≤10%', 检验方法: '同上，另取一份复测', 产线常规功能性结果: '8%', 结果判断: '合格' },
]

test('纸面列 = 八列(左四列单据级 + 检验要求/检验方法/产线常规功能性结果/结果判断)', () => {
  assert.deepEqual(PROC_INSP_COLS.map((c) => c.label),
    ['客户名称', '产品编码', '型号（mm）', '批号', '检验要求', '检验方法', '产线常规功能性结果', '结果判断'])
  // 型号/批号在库里叫 规格型号/批次号 —— 导出取值必须走 head 键,别拿纸面标题当键
  assert.equal(leftColValue(PROC_INSP_COLS[2], head), '28*12*178')
  assert.equal(leftColValue(PROC_INSP_COLS[3], head), '20261014')
  assert.equal(leftColValue(PROC_INSP_COLS[1], head), 'S032-3')
})

test('标题 / 副标题 / 抬头 / 表头两行 / 数据行 / 结论区:整体骨架与列数', () => {
  const out = buildProcInspExport({
    title: '制程检验记录表',
    subtitle: '惠州市银嘉环保科技有限公司　　单据编号：ZC-2026-10-0021　　单据状态：草稿',
    headPairs: [[{ label: '单据编号', value: 'ZC-2026-10-0021' }, { label: '单据日期', value: '2026-10-15' }]],
    head,
    rows,
  })
  const { aoa, cols, merges, headerRow1, headerRow2 } = out
  assert.equal(aoa[0][0], '制程检验记录表')
  assert.ok(/单据编号/.test(aoa[1][0]))
  assert.equal(aoa[2].length, 0)                                  // 空行
  assert.equal(aoa[3][0], '单据编号')                              // 抬头第一格 = 标签
  assert.equal(aoa[3][1], 'ZC-2026-10-0021')                      // 值
  assert.equal(aoa[3][4], '单据日期')
  assert.equal(headerRow2, headerRow1 + 1)
  assert.equal(aoa[headerRow1][4], '检验人员：admin')              // 检验人员跨 检验要求+检验方法
  assert.equal(aoa[headerRow1][5], '')
  assert.equal(aoa[headerRow1][6], '产线常规功能性结果')
  assert.equal(aoa[headerRow1][7], '结果判断')
  assert.equal(aoa[headerRow2][4], '以下检验要求自动填充出货检验计划表')
  assert.equal(aoa[headerRow2][5], '以下检验方法自动填充出货检验计划表')
  // 数据行:第 1 行左边四格 = **单据级取值**(列名在表头两行里,值在这里,纸面同形),
  // 右边四格是行值
  const r0 = aoa[headerRow2 + 1]
  assert.deepEqual(r0.slice(0, 4), ['对应客户项目名称', 'S032-3', '28*12*178', '20261014'])
  assert.equal(r0[4], rows[0]['检验要求'])
  assert.equal(r0[5], rows[0]['检验方法'])
  assert.equal(r0[6], '13%')
  assert.equal(r0[7], '合格')
  assert.equal(aoa[headerRow2 + 2][4], rows[1]['检验要求'])
  // 第 2 行起左侧四格留空(被首行的合并盖住,不重复写值)
  assert.deepEqual(aoa[headerRow2 + 2].slice(0, 4), ['', '', '', ''])
  // 列宽八列齐
  assert.equal(cols.length, 8)
  assert.equal(cols[5].wch, 46)                                    // 检验方法最宽
  // 合并:标题全宽 + 左侧四列**两段**(列名盖表头两行、取值盖整个表体)
  assert.deepEqual(merges[0], { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } })
  const labels = merges.filter((m) => m.s.c === m.e.c && m.s.c < 4 && m.s.r === headerRow1)
  assert.equal(labels.length, 4)
  for (const m of labels) assert.equal(m.e.r, headerRow2)
  const values = merges.filter((m) => m.s.c === m.e.c && m.s.c < 4 && m.s.r === headerRow2 + 1)
  assert.equal(values.length, 4)
  for (const m of values) assert.equal(m.e.r, headerRow2 + rows.length)
  // 抬头值格跨 3 列
  assert.ok(merges.some((m) => m.s.r === 3 && m.s.c === 1 && m.e.c === 3))
  // 结论区:检验人/审核人一行两格;检验结论跨余下全部列
  const foot = aoa.slice(-PROC_INSP_FOOT.length)
  assert.equal(foot[2][0], '检验人')
  assert.equal(foot[2][1], 'admin')
  assert.equal(foot[2][4], '审核人')
  assert.equal(foot[2][5], '李四')
  assert.equal(foot[0][0], '检验结论')
  assert.equal(foot[0][1], '合格')
  assert.ok(merges.some((m) => m.s.c === 1 && m.e.c === 7))
})

test('空单:数据行也留一行(左边四列仍显示单据级值,不塌成没有表体)', () => {
  const out = buildProcInspExport({ title: 'x', subtitle: 'y', headPairs: [], head, rows: [] })
  const { aoa, headerRow1, headerRow2, merges } = out
  const firstData = headerRow2 + 1
  assert.equal(aoa[firstData].length, 8)
  // ⚠ 这里必须断言**取值**,不是空串 —— 空单也要把 客户/产品/型号/批号 带出来(2026-10-17 修)
  assert.deepEqual(aoa[firstData].slice(0, 4), ['对应客户项目名称', 'S032-3', '28*12*178', '20261014'])
  for (let c = 0; c < 4; c++) {
    // 列名盖表头两行;取值盖表体(空单只有一行,首尾同一行)
    assert.ok(merges.some((m) => m.s.c === c && m.e.c === c && m.s.r === headerRow1 && m.e.r === headerRow2), `第 ${c} 列列名要合并表头两行`)
    assert.ok(merges.some((m) => m.s.c === c && m.e.c === c && m.s.r === firstData && m.e.r === firstData), `第 ${c} 列取值要落在表体`)
  }
})

test('长文本原样进单元格(不截断;换行交给 Excel 的 wrapText)', () => {
  const long = '1.称取100g Y料成品，从上到下依次放20目、325目筛网进行震动筛分，称量各目数占比并记录；'.repeat(3)
  const out = buildProcInspExport({ headPairs: [], head, rows: [{ 检验要求: 'a', 检验方法: long }] })
  const cell = out.aoa[out.headerRow2 + 1][5]
  assert.equal(cell, long)
  assert.ok(cell.length > 100)
})
