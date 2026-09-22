/**
 * docSheetConfigs 版式不变量单测（立项申请表 / 项目实施计划）
 *
 * 【为什么要有这份测试】
 * 这两张纸的版式是**照设计 xlsx 一比一复刻**的：
 *   设计源 = `C:\Users\x1787\OneDrive\Desktop\产品开发\产品开发\1.产品开发\`
 *            `立项申请表.xlsx`（Sheet1，范围 B1:M16）
 *            `项目实施计划.xlsx`（Sheet1，范围 B2:G15）
 * 2026-09-22 逐格对照发现 4 类偏差，其中 3 类属于「改了一半 / 漏做」，改完必须钉住，
 * 否则下次改字段或调版式会再飘回去：
 *
 *   ① 标题少「四」级：设计写「二三四级」（B2 / B3），实现写成「二三级项目」
 *   ② 项目定级下拉只有 二/三/四级，而库字典（migrate-approval-level.sql，2026-09-21）
 *      已按用户口径补了「一级」⇒ 纸面永远选不到一级
 *   ③ 立项申请表右侧设计是**可填的「备注」区**（F5 标签 + F6:G15 合并填写区），
 *      实现只画了一条装饰虚线（`.as-deco`），`rd_approval.备注` 列存在却没登记字段
 *   ④ 实施计划第 8 行（设计 B15=8 / C15=负责人 / F15=编制日期：）在实现里被挪到底部签名区
 *
 * 行高换算口径：设计是 Excel 磅值(pt)，实现是 px(`DocSheet.vue` 用 `height: row.h + 'px'`)，
 * 96dpi 下 **1pt = 4/3 px**。合并行的设计高度 = 参与合并的各行之和
 * （Excel 未标高度的行按默认 14.25pt 计，如立项申请 B6:B9 的 立项背景 = 38.25+33+14.25+14.25）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { approvalSheetCfg, planSheetCfg } from './docSheetConfigs.js'

/** 96dpi：1pt = 4/3 px，四舍五入到整数像素 */
const px = (pt) => Math.round((pt * 4) / 3)

// ── ① 标题按设计原文 ────────────────────────────────────────────────────────
// DocSheet 的拼法是 `titlePart1（titlePart2）titlePart3`（DocSheet.vue:54）
test('立项申请表标题按设计：立项申请表（二三四级项目）', () => {
  assert.equal(approvalSheetCfg.titlePart1, '立项申请表')
  assert.equal(approvalSheetCfg.titlePart2, '二三四级项目', '设计 B2 = 立项申请表（二三四级项目）')
  assert.equal(approvalSheetCfg.titlePart3 || '', '')
})

test('项目实施计划标题按设计：项目（二三四级）实施计划', () => {
  assert.equal(planSheetCfg.titlePart1, '项目')
  assert.equal(planSheetCfg.titlePart2, '二三四级', '设计 B3 = 项目（二三四级）实施计划')
  assert.equal(planSheetCfg.titlePart3, '实施计划')
})

// ── ② 项目定级下拉必须与库字典口径一致（含「一级」）────────────────────────
test('实施计划项目定级下拉含一级（与库字典 / 2026-09-21 四级口径一致）', () => {
  const row = planSheetCfg.rows.find((r) => r.label === '项目定级')
  assert.ok(row, '必须有 项目定级 行')
  assert.equal(row.kind, 'select')
  const values = (row.options || []).map((o) => o.value)
  assert.deepEqual(values, ['一级', '二级', '三级', '四级'],
    'yj_field.RD_PLAN.项目定级 字典已含一级；纸面下拉少一级会让参照带入的一级值选不中')
})

// ── ③ 立项申请表右侧「备注」= 可填字段（设计 F5 + F6:G15）────────────────────
test('立项申请表有可填备注区（设计 F5「备注」+ F6:G15 合并填写区）', () => {
  assert.ok(approvalSheetCfg.remark, 'config.remark 必须存在（DocSheet 据此渲染右侧填写列）')
  assert.equal(approvalSheetCfg.remark.key, '备注', '数据键 = 字段 label（rd_approval.备注）')
  assert.equal(approvalSheetCfg.remark.label, '备注')
  // 上限必须 ≤ 物理列宽(rd_approval.备注 = nvarchar(1000)),否则保存报截断
  assert.ok(approvalSheetCfg.remark.max >= 200 && approvalSheetCfg.remark.max <= 1000, '备注上限应 ≤ 列宽 1000')
})

test('实施计划没有备注区（设计该表无此块，不该被顺带加上）', () => {
  assert.ok(!planSheetCfg.remark)
})

// ── ④ 实施计划第 8 行承载「负责人 + 编制日期」（设计 B15/C15/F15）──────────
test('实施计划第 8 行 = 负责人 + 编制日期（设计末行，不再落到底部签名区）', () => {
  const row = planSheetCfg.rows.find((r) => String(r.num) === '8')
  assert.ok(row, '必须有第 8 行')
  assert.equal(row.label, '负责人')
  assert.equal(row.key, '负责人')
  assert.ok(row.second, '同一行右侧还要有 编制日期（设计 F15「编制日期：」）')
  assert.equal(row.second.label, '编制日期')
  assert.equal(row.second.key, '编制日期')
  assert.equal(row.second.kind, 'date')
})

test('负责人/编制日期 不得同时出现在签名区（避免同一字段渲染两遍）', () => {
  const labels = (planSheetCfg.signCells || []).map((c) => c.label)
  for (const l of ['负责人', '编制日期']) {
    assert.ok(!labels.includes(l), `${l} 已移到第 8 行，签名区不得重复`)
  }
})

/**
 * 版式细节(row.second 必须横向排布):
 * 设计 B15..G15 是三格并排「负责人值区(D:E) | 编制日期：标签格(F) | 日期值区(G)」。
 * `.as-fill` 缺省是 `flex-direction: column` —— 少了 `.as-fill-split` 的横向覆盖,
 * 第二字段会被挤到**下一行**(2026-09-22 实测踩到,用户拿设计照片指出来的)。
 * 单测跑不了 CSS,所以这里按仓库既有做法(同 recordSheetConfigs.docno.test.js)读源码断言。
 */
test('DocSheet 对 row.second 的行必须切成横向(.as-fill-split + flex-direction: row)', () => {
  const src = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
  assert.ok(
    /class="as-fill"\s+:class="\{ 'as-fill-split': !!row\.second \}"/.test(src),
    '单字段行的 .as-fill 必须按 row.second 挂 as-fill-split(否则第二字段落到下一行)',
  )
  assert.ok(
    /\.as-fill-split\s*\{[^}]*flex-direction:\s*row/.test(src),
    '.as-fill-split 必须显式 flex-direction: row(覆盖 .as-fill 的 column)',
  )
})

// ── 行高：按设计磅值 ×4/3 ──────────────────────────────────────────────────
// 立项申请表.xlsx 行高: [33,24,18.75,20.25,33.75,38.25,33,null,null,41.25,75.75,157.5,70.5,41.25,41.25,33]
//   客户名=row5(33.75) 立项背景=B6:B9合并(38.25+33+14.25+14.25) 机型=row10(41.25)
//   滤芯=row11(75.75) 目标=row12(157.5) 输出=row13(70.5) 周期=row14(41.25) 其它=row15(41.25)
test('立项申请表行高按设计磅值换算（1pt = 4/3 px）', () => {
  const want = {
    客户名: px(33.75),
    立项背景: px(38.25 + 33 + 14.25 + 14.25),
    '机型及应用位置': px(41.25),
    '滤芯/炭棒规格或结构': px(75.75),
    项目开发目标: px(157.5),
    项目输出: px(70.5),
    开发周期要求: px(41.25),
    其它要求: px(41.25),
  }
  for (const row of approvalSheetCfg.rows) {
    assert.equal(row.h, want[row.label], `${row.label} 行高应为设计 ${JSON.stringify(want[row.label])}px`)
  }
  assert.equal(approvalSheetCfg.rows.length, Object.keys(want).length, '行数应与设计 8 节一致')
})

// 项目实施计划.xlsx 行高: [20.15,27.75,27.75,27.75,33.75,33.75,32.1,77.1,60.95,39.95,39.95,39.95,68.25,30]
//   项目名称=row6(33.75) 项目定级=row7(33.75) 测试内容=row8(32.1) 打样要求=row9(77.1)
//   测试目标=row10(60.95) 测试方案=row11:13合并(39.95×3) 测试计划=row14(68.25) 负责人=row15(30)
test('项目实施计划行高按设计磅值换算（1pt = 4/3 px）', () => {
  const want = {
    项目名称: px(33.75),
    项目定级: px(33.75),
    测试内容: px(32.1),
    测试产品打样要求: px(77.1),
    测试目标: px(60.95),
    测试方案: px(39.95 * 3),
    测试计划: px(68.25),
    负责人: px(30),
  }
  for (const row of planSheetCfg.rows) {
    const label = row.label
    assert.ok(label in want, `设计里没有的行：${label}`)
    assert.equal(row.h, want[label], `${label} 行高应为设计 ${want[label]}px`)
  }
  assert.equal(planSheetCfg.rows.length, Object.keys(want).length, '行数应与设计 8 行一致')
})
