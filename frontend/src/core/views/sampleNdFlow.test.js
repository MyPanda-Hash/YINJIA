/**
 * 外部-非开发样品申请单（RD_SAMPLE_ND）的标题与审批流（2026-11-18 用户口径）。
 *
 * 用户原话：「这个的面板的标题改一下，加上一个非开发样品申请单，加上审批流，
 *            要有提交然后审批，一级审批就行」。
 *
 * 约定：
 *   · 标题 = （外部）（非开发样品申请单）；
 *   · 纸面只有「申请 / 审核」两格（一级审批），span 合计 = 表体 8 列；
 *   · 侧栏必须放出「提交审批 / 审批通过 / 审批驳回 / 审批情况」；
 *   · 后端**不进**两级名单，走通用单级审批；签名落点 = rd_sample_nondev_head 的「申请 / 审核」列。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sampleNdSheetCfg, sampleExtSheetCfg } from './docSheetConfigs.js'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const btn = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')

test('标题 = 非开发样品申请单，且与外部开发样品单共用版式', () => {
  assert.equal(sampleNdSheetCfg.titlePart1, sampleExtSheetCfg.titlePart1, '前缀仍是（外部）')
  assert.equal(sampleNdSheetCfg.titlePart2, '非开发样品申请单')
  assert.equal(sampleNdSheetCfg.layout, 'grid', '仍是表格式纸面')
  // 2026-11-19 销售问题汇总 P5：非开发单的列**故意**与开发单不同 ——
  //   去掉 产品整体规格/产品功能/性能要求，前面加 产品编码/产品名称（7 列）。
  assert.deepEqual(sampleNdSheetCfg.grid.cols.map((c) => c.key),
    ['产品编码', '产品名称', '炭棒规格', '样品数量', '组装要求', '背景', '配方及工艺要求'])
})

test('一级审批：纸面只留「申请 / 审核」两格，span 合计 = 7', () => {
  const cells = sampleNdSheetCfg.signCells
  assert.deepEqual(cells.map((c) => c.label), ['申请', '审核'], '没有「确认」格（一级审批）')
  assert.equal(cells.reduce((n, c) => n + c.span, 0), 7, '签名条要铺满 7 列，否则竖线对不齐')
})

test('侧栏放出审批按钮组，且 ND 用独立配置', () => {
  assert.match(list, /if \(panelCode\.value === 'RD_SAMPLE_ND'\) return sampleNdSheetCfg/, 'ND 必须用独立配置')
  assert.match(list, /sampleIntSheetCfg, sampleNdSheetCfg \} from '\.\/docSheetConfigs'/, '要 import 新配置')
  const at = list.indexOf('const hasApprovalBtns = computed')
  const seg = list.slice(at, at + 2000)
  assert.match(seg, /RD_SAMPLE_ND/, 'hasApprovalBtns 要包含 ND')
})

test('后端：ND 走单级审批（不在两级名单），签名落点是 head 的申请/审核列', () => {
  assert.doesNotMatch(btn, /s\.add\("RD_SAMPLE_ND"\)/, 'ND 不得进 TWO_LEVEL_PANELS')
  assert.match(btn, /"RD_SAMPLE_ND", new String\[\]\{"申请", "审核", "审核"\}/,
    '单级通过写「确认」槽位 ⇒ 该槽位必须指向「审核」列')
  assert.match(btn, /"RD_SAMPLE_ND", "rd_sample_nondev_head"/, '表名要登记')
})
