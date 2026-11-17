/**
 * purInSplit.test.js —— 采购入库单「一行明细拆成多个仓库」的回归闸(2026-11-17 客户口径)
 *
 * 客户原话:「采购入库单在草稿状态下要可以实现一个明细划分多个仓库来存放」;
 *   确认做法时选了「直接把明细拆成多条行」,并补一句「但是来源采购订单行号和上游的行号不变」;
 *   数量口径「各仓库合计 = 该行实收数量」。
 *
 * 本测试守四件事:
 *   ① **纯函数口径**:默认怎么分、合计对不对、差额算得对、容差(Four 小数)不误报;
 *   ② **入口只对采购入库单开**:PanelxForm 的拆分图标带 `v-if="isPurInPanel"`,
 *      而且必须先落库(没有 id 的行服务端拆不了);
 *   ③ **服务端那条链没被绕过**:前端只提交分配清单(purIn/split),复制行/分摊金额/拆占用链在
 *      PurInSplitService 里;并且服务端自己校验「草稿 + 未转ERP + 合计相等」,不靠前端;
 *   ④ **词条全语种**(切 en / ja 不露中文)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  SPLIT_EPS, allocSum, allocSummary, canSplitRow, defaultAllocs, numOr0, remainingQty,
  rowTotalQty, toPayload, validateAllocs,
} from './purInSplit.js'

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const ROW = {
  id: 1434,
  存货编码: 'YJ-ZZ-001',
  实收数量: 8,
  仓库: '恒亿仓',
  仓库编码: 'CK00006',
  仓位编码: 'A-01',
  批次号: '20261113',
  源单行号: '1',
}

test('① 取数与可拆判定:没有 id(未落库)不能拆、实收数量 0 不能拆', () => {
  assert.equal(numOr0(null), 0)
  assert.equal(numOr0('8'), 8)
  assert.equal(numOr0('abc'), 0)
  assert.equal(rowTotalQty(ROW), 8)
  assert.equal(canSplitRow(ROW), true)
  assert.equal(canSplitRow({ ...ROW, id: null }), false, '未落库的行服务端按 id 找不到,不许点')
  assert.equal(canSplitRow({ ...ROW, 实收数量: 0 }), false)
  assert.equal(canSplitRow(null), false)
})

test('① 默认分配 = 两条(原仓库全量 + 空仓 0),合计恰好等于实收数量', () => {
  const allocs = defaultAllocs(ROW)
  assert.equal(allocs.length, 2)
  assert.equal(allocs[0]['仓库'], '恒亿仓')
  assert.equal(allocs[0]['数量'], 8)
  assert.equal(allocs[1]['仓库'], '')
  assert.equal(allocSum(allocs), 8)
  assert.equal(remainingQty(allocs, 8), 0)
})

test('① 校验:少行 / 没选仓库 / 数量非正 / 合计不等 都要拦下来', () => {
  assert.deepEqual(validateAllocs([{ 仓库: 'A', 数量: 8 }], 8).problems.map((p) => p.code), ['needTwo'])
  const noWh = validateAllocs([{ 仓库: '', 数量: 8 }, { 仓库: 'B', 数量: 0 }], 8)
  assert.ok(noWh.problems.some((p) => p.code === 'noWh'))
  const badQty = validateAllocs([{ 仓库: 'A', 数量: 0 }, { 仓库: 'B', 数量: 8 }], 8)
  assert.ok(badQty.problems.some((p) => p.code === 'qtyNotPositive'))
  const mismatch = validateAllocs([{ 仓库: 'A', 数量: 3 }, { 仓库: 'B', 数量: 4 }], 8)
  assert.equal(mismatch.ok, false)
  assert.ok(mismatch.problems.some((p) => p.code === 'sumMismatch'))
  assert.equal(mismatch.diff, -1, '差额 = 已分 - 实收')
})

test('① 合规分配直接通过(2 行、合计相等)', () => {
  const allocs = [{ 仓库: '恒亿仓', 数量: 6 }, { 仓库: '成品B仓', 数量: 2 }]
  const r = validateAllocs(allocs, 8)
  assert.equal(r.ok, true)
  assert.deepEqual(r.problems, [])
  assert.equal(r.sum, 8)
  assert.equal(r.diff, 0)
})

test('① 容差按 4 位小数:0.00004 算平,0.001 不算平(与 decimal(18,4) 同口径)', () => {
  const ok = validateAllocs([{ 仓库: 'A', 数量: 4.00002 }, { 仓库: 'B', 数量: 3.99998 }], 8)
  assert.equal(ok.ok, true)
  assert.ok(Math.abs(ok.diff) <= SPLIT_EPS)
  const bad = validateAllocs([{ 仓库: 'A', 数量: 4 }, { 仓库: 'B', 数量: 3.999 }], 8)
  assert.equal(bad.ok, false)
})

test('① 提交清单:空仓库行剔除、数量收口到 4 位小数、仓库名两端去空格', () => {
  const payload = toPayload([
    { 仓库: ' 恒亿仓 ', 仓位编码: ' A-01 ', 数量: 6.00001 },
    { 仓库: '', 仓位编码: '', 数量: 2 },
    { 仓库: '成品B仓', 数量: 2 },
  ])
  assert.equal(payload.length, 2)
  assert.deepEqual(payload[0], { 仓库: '恒亿仓', 仓位编码: 'A-01', 数量: 6 })
  assert.deepEqual(payload[1], { 仓库: '成品B仓', 仓位编码: '', 数量: 2 })
  assert.equal(allocSummary([{ 仓库: '恒亿仓', 数量: 6 }, { 仓库: '成品B仓', 数量: 2 }]), '恒亿仓 6 / 成品B仓 2')
})

test('② 入口只对采购入库单开,且未落库时提示先保存', () => {
  const form = src('./../views/PanelxForm.vue')
  assert.ok(/isPurInPanel = computed\(\(\) => String\(panelCode\.value\) === 'PURCHASE_IN'\)/.test(form),
    '拆分入口必须按面板码判定(不能所有单据都出现)')
  assert.ok(/v-if="isPurInPanel"/.test(form), '拆分图标要带 v-if="isPurInPanel"')
  assert.ok(/openPurInSplit\(/.test(form), '拆分图标要接到 openPurInSplit')
  assert.ok(/canSplitRow\(row\)/.test(form), '未落库/数量为 0 的行必须被 canSplitRow 拦下')
  assert.ok(/请先保存单据，再拆分仓库/.test(form), '拦下时要说明"先保存"')
  assert.ok(/<PurInSplitDialog/.test(form), '拆行弹窗要挂载')
  assert.ok(/:doc-no="form\['单据编号'\]/.test(form), '弹窗必须带上单据编号(服务端据此校验草稿/ERP)')
})

test('② 弹窗复用同一份校验,差额不为 0 时「确定拆分」不可点', () => {
  const dlg = src('./../views/PurInSplitDialog.vue')
  assert.ok(/validateAllocs\(allocs, total\.value\)/.test(dlg), '弹窗校验必须走纯函数')
  assert.ok(/:disabled="!canSubmit"/.test(dlg), '校验不过时不许提交')
  assert.ok(/splitPurInLine\(/.test(dlg), '提交走引擎的 splitPurInLine')
  assert.ok(/来源采购订单行号与批次号保持不变/.test(dlg), '要在界面上讲清"来源行号/批次号不变"')
})

test('③ 前端只提交清单,复制行/分摊金额/拆占用链在服务端', () => {
  const engine = src('./../../business/engine.js')
  assert.ok(/splitPurInLine/.test(engine) && /'\/px\/purIn\/split'/.test(engine), '引擎要打 purIn/split')
  const svc = src('./../../../../backend/src/main/java/com/yinjia/mes/service/PurInSplitService.java')
  // 服务端自己的守卫(不依赖前端):草稿、未转ERP、已作废、合计相等
  assert.ok(/只有草稿状态的采购入库单可以拆分/.test(svc))
  assert.ok(/是否已转ERP/.test(svc), '已转ERP 的不能拆(会让 MES 与金蝶两侧不一致)')
  assert.ok(/yj_doc_status/.test(svc) && /已作废,不能拆分/.test(svc),
    '单头 单据状态 还写着草稿、但 yj_doc_status 已作废的单,同样不能拆(2026-11-17 实测踩到)')
  assert.ok(/必须等于本行实收数量/.test(svc), '合计相等必须服务端再校验一遍')
  // 用户点名的那条:来源采购订单行号(源单行号)与批次号靠"整行复制"保住
  assert.ok(/原样复制/.test(svc) && /源单行号/.test(svc), '拆出来的行要原样带 源单行号')
  // 占用链跟着拆
  assert.ok(/form_flow_link/.test(svc) && /replicateLinks/.test(svc), '占用链要一起拆')
  // 一个事务:行拆了链没拆会让"已入库量"永久对不上
  assert.ok(/@Transactional/.test(svc), '拆行必须一个事务')
})

test('④ 新增词条在 10 个语言包里都有译名(切 en / ja 不露中文)', () => {
  const keys = [
    '拆分仓库', '采购订单行号', '增加一行', '已分配合计', '差额', '至少要分到两个仓库',
    '确定拆分', '拆分失败', '拆分成功，已拆成 {n} 行', '请先保存单据，再拆分仓库',
  ]
  for (const locale of ['en', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']) {
    const text = src(`../../i18n/locales/${locale}.js`)
    for (const k of keys) {
      const hit = new RegExp(`'${k}':\\s*'([^']+)'`).exec(text)
      assert.ok(hit, `${locale}.js 缺词条:${k}`)
      // zh-TW 是中文繁体:像「增加一行」这种繁简同形,译名与原文相同是正常的,只要求非中文语言不回落中文
      if (locale !== 'zh-TW') assert.notEqual(hit[1].trim(), k, `${locale}.js 的「${k}」还是中文原文`)
    }
  }
})
