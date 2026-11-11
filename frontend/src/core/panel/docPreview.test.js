import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PREVIEW_COMPACT_CAP, PREVIEW_FIELDS, PREVIEW_SKIP, PREVIEW_VALUE_CAP,
  previewLineText, previewSummaryOf,
} from './docPreview.js'

/**
 * 文书侧栏「单据预览查找」的卡片摘要（2026-11-11 用户口径）。
 *
 * 用户原话：「立项申请的单据预览做成和销售订单左侧栏类似，显示最主要的信息方便去查找对应单据」。
 * 参照物（销售订单选择左侧列表）= 一行一张单：单号 / 日期 / 客户 / 审核状态。
 *
 * 钉住两件事：
 *   ① 立项申请的卡片**只显示客户名（+ 项目等级）**，不带长文本、不带标签 —— 卡片两行扫完；
 *   ② 没登记的面板**行为不变**（前 4 个非空业务字段、带标签、42 字截断）——
 *      这是"改一个面板别顺手改掉十三个面板"的防线。
 */

const fields = [
  { dataName: '单据编号' }, { dataName: '单据日期' }, { dataName: '客户名' },
  { dataName: '立项背景' }, { dataName: '机型及应用位置' }, { dataName: '滤芯炭棒规格或结构' },
  { dataName: '项目开发目标' }, { dataName: '项目等级' },
]
const keyOf = (f) => f.dataName

const approvalRow = {
  单据编号: 'LXA-2026-11-011',
  单据日期: '2026-11-10',
  单据状态: '已归档',
  客户名: '零售客户',
  立项背景: '客户希望开发一款带抑菌功能的家用滤芯，目标是明年的新品线，需要联动炭棒配方一起改',
  机型及应用位置: '1',
  滤芯炭棒规格或结构: '1',
  项目等级: '二',
}

test('① 立项申请：只出客户名 + 项目等级，且 compact（不带标签、一行拼起来）', () => {
  const s = previewSummaryOf({ row: approvalRow, fields, keyOf, panelCode: 'RD_APPROVAL' })
  assert.equal(s.compact, true, '登记过摘要字段的面板必须 compact')
  assert.deepEqual(s.items.map((x) => x.label), ['客户名', '项目等级'])
  assert.deepEqual(s.items.map((x) => x.value), ['零售客户', '二'])
  assert.equal(previewLineText(s), '零售客户 · 二', '日期与这一行同排显示由调用方拼')
  // 长文本一格都不许混进来（那正是"一张卡片十行"的来源）
  const labels = s.items.map((x) => x.label)
  for (const k of ['立项背景', '机型及应用位置', '滤芯炭棒规格或结构', '项目开发目标']) {
    assert.ok(!labels.includes(k), `${k} 是长文本，不该出现在预览卡片上`)
  }
})

test('② 立项申请：空摘要字段跳过（不留"客户名：—"这种空行）', () => {
  const s = previewSummaryOf({
    row: { ...approvalRow, 客户名: '   ', 项目等级: '' }, fields, keyOf, panelCode: 'RD_APPROVAL',
  })
  assert.deepEqual(s.items, [])
  assert.equal(previewLineText(s), '')
})

test('③ 其他面板行为不变：前 4 个非空业务字段、带标签、42 字截断', () => {
  const s = previewSummaryOf({ row: approvalRow, fields, keyOf, panelCode: 'RD_SPEC_DOC' })
  assert.equal(s.compact, false, '没登记的面板必须走旧口径')
  assert.deepEqual(s.items.map((x) => x.label), ['客户名', '立项背景', '机型及应用位置', '滤芯炭棒规格或结构'],
    '系统列(单据编号/单据日期)要按 PREVIEW_SKIP 剔掉，最多 4 个')
  assert.ok(s.items.every((x) => x.value.length <= PREVIEW_VALUE_CAP + 1), '超过 42 字要截断加省略号')
})

test('④ 通用口径的剔除清单与阶段列：单据编号/备注/阶段N 不进卡片', () => {
  const row = { 单据编号: 'A-1', 单据日期: '2026-11-10', 备注: 'x', 阶段1状态: 'y', 客户名: '甲' }
  const s = previewSummaryOf({
    row, fields: [{ dataName: '单据编号' }, { dataName: '备注' }, { dataName: '阶段1状态' }, { dataName: '客户名' }],
    keyOf, panelCode: 'RD_OTHER',
  })
  assert.deepEqual(s.items.map((x) => x.label), ['客户名'])
  assert.ok(PREVIEW_SKIP.has('备注') && PREVIEW_SKIP.has('单据编号'))
})

test('⑤ 指定字段的截断比通用口径短（一行放得下）', () => {
  const long = '某某某某某某某某某某某某某某某某某某某某客户'
  const s = previewSummaryOf({
    row: { 客户名: long }, fields, keyOf, panelCode: 'RD_APPROVAL',
  })
  assert.equal(s.items[0].value.length, PREVIEW_COMPACT_CAP + 1, '截到 18 字 + 省略号')
  assert.ok(s.items[0].value.endsWith('…'))
})

test('⑥ 登记表本身：立项申请有摘要字段，且都是真实存在的表头字段名', () => {
  assert.deepEqual(PREVIEW_FIELDS.RD_APPROVAL, ['客户名', '项目等级'])
  const real = new Set(fields.map((f) => f.dataName))
  for (const k of PREVIEW_FIELDS.RD_APPROVAL) assert.ok(real.has(k), `${k} 不在表头字段里(打错字就永远不显示)`)
})
