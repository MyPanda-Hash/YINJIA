/**
 * mixScan.test.js — 扫码混料纯逻辑单测(2026-11-18;第四轮随两页结构改版)
 *
 * 每条断言都指向具体生产逻辑,改坏必红:
 *   · parseWorkOrderQr   → 工单码 `公司代码@工单号@(1000+行号)` 的解析与减 1000
 *   · toMixRows         → 后端 /px/mix/task 的明细 → 页面行(应投/实投/待投/已确认)
 *   · toSavedRows       → 已保存单据(/px/mix/doc,纸面口径字符串)→ 只读明细行
 *   · applyConfirm      → **覆盖写入**(不是累加)、只按编码匹配、超投标记
 *   · checkScaleReading → 脏值(-1)/过期/跳动 的拦截
 *   · scaleReadingOf    → /dc/monitor 扁平 points 的形状归一(重量点位 / 状态 / 设备码)
 *   · mixProgress       → 「全部物料确认完毕才能提交」的判据
 *   · buildScanPayload  → 确认写入 POST /px/mix/scan 的字段名(与后端正文字段逐一对应)
 *   · buildMixSlipPayload → 混料单纸面载荷(《成型配料记录》横板 A4)
 *   · 页面静态检查       → 两个页面的文案都有英文译名;原生扫码只走 window.YjNative
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseWorkOrderQr,
  toMixRows,
  toSavedRows,
  applyConfirm,
  checkScaleReading,
  scaleReadingOf,
  mixProgress,
  buildScanPayload,
  buildMixSlipPayload,
  MIX_PAPER,
} from './mixScan.js'

test('parseWorkOrderQr:标准工单码 → 行号减 1000', () => {
  const r = parseWorkOrderQr('YJ@GD-2026-10-0220@1002')
  assert.equal(r.ok, true)
  assert.equal(r.company, 'YJ')
  assert.equal(r.orderNo, 'GD-2026-10-0220')
  assert.equal(r.lineNo, 2)
})

test('parseWorkOrderQr:行号 1001 → 1,1000 → 0', () => {
  assert.equal(parseWorkOrderQr('YJ@GD-1@1001').lineNo, 1)
  assert.equal(parseWorkOrderQr('YJ@GD-1@1000').lineNo, 0)
})

// 2026-11-18:领料单纸面二维码第 4 段 = 领料标记(A=组装 / M=混料);
//   扫码混料页仍按前 3 段取数,多一段不能把解析搞坏。
test('parseWorkOrderQr:带领料标记的第 4 段 ⇒ 前 3 段照旧,kind 带出来', () => {
  const mix = parseWorkOrderQr('0@GD-2026-10-0220@1002@M')
  assert.equal(mix.ok, true)
  assert.equal(mix.orderNo, 'GD-2026-10-0220')
  assert.equal(mix.lineNo, 2)
  assert.equal(mix.kind, '混料')
  assert.equal(parseWorkOrderQr('0@GD-2026-10-0220@1002@A').kind, '组装')
  assert.equal(parseWorkOrderQr('0@GD-2026-10-0220@1002').kind, '', '老的三段码 kind 为空')
})

test('parseWorkOrderQr:没有行号段 → lineNo=0(整单)', () => {
  const r = parseWorkOrderQr('YJ@GD-2026-10-0220')
  assert.equal(r.ok, true)
  assert.equal(r.orderNo, 'GD-2026-10-0220')
  assert.equal(r.lineNo, 0)
})

test('parseWorkOrderQr:不带 1000 前缀的裸行号也认', () => {
  assert.equal(parseWorkOrderQr('YJ@GD-1@3').lineNo, 3)
})

test('parseWorkOrderQr:空串/无工单号/行号非数字 → 拒绝', () => {
  assert.equal(parseWorkOrderQr('').reason, 'empty')
  assert.equal(parseWorkOrderQr('   ').reason, 'empty')
  assert.equal(parseWorkOrderQr('YJ').reason, 'no-order')
  assert.equal(parseWorkOrderQr('YJ@').reason, 'no-order')
  assert.equal(parseWorkOrderQr('YJ@GD-1@abc').reason, 'bad-line')
})

test('parseWorkOrderQr:扫到物料码(含 |)不该被当工单码', () => {
  // 物料码 YJ-SX-001|20261014001 没有 @ → 判为 no-order
  const r = parseWorkOrderQr('YJ-SX-001|20261014001')
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'no-order')
})

test('parseWorkOrderQr:手敲的单号/产品名片段不走这里,交给页面的模糊查询', () => {
  // 2026-11-17 用户口径「扫码混料没有模糊查询的栏框」:非 @ 串 ⇒ 页面转 /px/workOrderList 模糊查,
  // 解析器本身仍然只认二维码,免得物料码被当成工单号
  assert.equal(parseWorkOrderQr('GD-2026-10-0221').reason, 'no-order')
  assert.equal(parseWorkOrderQr('0015').reason, 'no-order')
  assert.equal(parseWorkOrderQr('烧结炭棒').reason, 'no-order')
})

// ═══════════ 行模型(后端取数 → 页面行)═══════════

/** 后端 /px/mix/task 的明细形状(应投/实投由服务端按物料清单算好) */
const taskLines = () => ([
  { 行id: 11, 物料编号: 'YJ-TJHZ-001', 物料名称: '雅可比CS', 规格型号: '80-200', 单位: 'kg', 应投: 86.172, 实投: 0, 待投: 86.172, 物料批次: '', 已确认: false },
  { 行id: 0, 物料编号: 'YJ-YKRS-005', 物料名称: '活性炭', 规格型号: '椰壳', 单位: 'kg', 应投: 21.042, 实投: 0, 待投: 21.042, 物料批次: '', 已确认: false },
])

test('toMixRows:后端明细 → 页面行(编码/规格/单位/应投/实投/待投全部带过来)', () => {
  const rows = toMixRows(taskLines())
  assert.equal(rows.length, 2)
  assert.equal(rows[0].编码, 'YJ-TJHZ-001')
  assert.equal(rows[0].名称, '雅可比CS')
  assert.equal(rows[0].规格, '80-200')
  assert.equal(rows[0].单位, 'kg')
  assert.equal(rows[0].应投, 86.172)
  assert.equal(rows[0].待投, 86.172)
  assert.equal(rows[1].行id, 0)
  assert.equal(rows[1].已确认, false)
})

test('toMixRows:后端缺字段/空数组不炸(页面按空明细走)', () => {
  assert.deepEqual(toMixRows(null), [])
  assert.deepEqual(toMixRows([]), [])
  const row = toMixRows([{}])[0]
  assert.equal(row.编码, '')
  assert.equal(row.应投, 0)
  assert.equal(row.实投, 0)
  assert.equal(row.已确认, false)
})

test('toSavedRows:纸面口径的字符串重量 → 只读明细的数字行', () => {
  const rows = toSavedRows([
    { 序号: '1', 物料编号: 'YJ-TJHZ-001', 物料名: '雅可比CS', 应投重量: '86.172', 实投重量: '86.172', 物料批次: '20261118001', 添加比例: '80.38%', 规格型号: '80-200', 单位: 'kg' },
  ])
  assert.equal(rows[0].编码, 'YJ-TJHZ-001')
  assert.equal(rows[0].名称, '雅可比CS')
  assert.equal(rows[0].应投, 86.172)
  assert.equal(rows[0].实投, 86.172)
  assert.equal(rows[0].批号, '20261118001')
  assert.equal(rows[0].比例, '80.38%')
  assert.equal(rows[0].单位, 'kg')
})

test('applyConfirm:确认 = **覆盖**写入(不是累加 —— 2026-11-18 第四轮口径)', () => {
  const rows = toMixRows(taskLines())
  applyConfirm(rows, { code: 'YJ-TJHZ-001', qty: 86.172 })
  assert.equal(rows[0].实投, 86.172)
  assert.equal(rows[0].待投, 0)
  assert.equal(rows[0].已确认, true)
  // 再确认一次同样的料 ⇒ 以最后一次秤值为准(如果累加这里会是 172.344)
  applyConfirm(rows, { code: 'YJ-TJHZ-001', qty: 80 })
  assert.equal(rows[0].实投, 80)
  assert.equal(rows[0].待投, 6.172)
})

test('applyConfirm:只按编码匹配 —— 码里的批号不参与过滤,但会记到行上', () => {
  const rows = toMixRows(taskLines())
  const r = applyConfirm(rows, { code: 'YJ-YKRS-005', qty: 21, batch: '20261118002' })
  assert.equal(r.ok, true)
  assert.equal(r.index, 1)
  assert.equal(rows[1].批号, '20261118002')
})

test('applyConfirm:编码不在物料清单里 → miss,不改动任何行', () => {
  const rows = toMixRows(taskLines())
  const r = applyConfirm(rows, { code: 'X-999', qty: 2 })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'miss')
  assert.equal(rows[0].实投, 0)
})

test('applyConfirm:数量 <=0 或非数字 → no-qty', () => {
  const rows = toMixRows(taskLines())
  assert.equal(applyConfirm(rows, { code: 'YJ-TJHZ-001' }, 0).reason, 'no-qty')
  assert.equal(applyConfirm(rows, { code: 'YJ-TJHZ-001' }, -1).reason, 'no-qty')
  assert.equal(applyConfirm(rows, { code: 'YJ-TJHZ-001' }, 'abc').reason, 'no-qty')
})

test('applyConfirm:超投不拦死,但待投为负且标 exceed', () => {
  const rows = toMixRows(taskLines())
  const r = applyConfirm(rows, { code: 'YJ-TJHZ-001', qty: 90 })
  assert.equal(r.ok, true)
  assert.equal(r.exceed, true)
  assert.equal(rows[0].待投, -3.828)
})

test('checkScaleReading:正常稳定读数通过', () => {
  const now = 1000000
  const r = checkScaleReading({ value: 9.44, at: new Date(now - 1000) }, null, { now })
  assert.equal(r.ok, false)   // 无 stable 标志且无上一次 → 不稳定
  const r2 = checkScaleReading({ value: 9.44, at: new Date(now - 1000), stable: true }, null, { now })
  assert.equal(r2.ok, true)
  assert.equal(r2.value, 9.44)
})

test('checkScaleReading:连续两次一致才认稳定', () => {
  const now = 1000000
  const prev = { value: 9.44, at: new Date(now - 2000) }
  const r = checkScaleReading({ value: 9.44, at: new Date(now - 1000) }, prev, { now })
  assert.equal(r.ok, true)
  // 跳动的值不认
  const r2 = checkScaleReading({ value: 9.51, at: new Date(now - 1000) }, prev, { now })
  assert.equal(r2.ok, false)
  assert.equal(r2.reason, 'unstable')
})

test('checkScaleReading:库里出现过的 -1 脏值必须拦下', () => {
  const now = 1000000
  const r = checkScaleReading({ value: -1, at: new Date(now - 500), stable: true }, null, { now })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'negative')
})

test('checkScaleReading:0 也拦下(空秤)', () => {
  const now = 1000000
  assert.equal(checkScaleReading({ value: 0, at: new Date(now - 500) }, null, { now }).reason, 'negative')
})

test('checkScaleReading:过期读数(超窗口)→ stale', () => {
  const now = 1000000
  const r = checkScaleReading({ value: 9.44, at: new Date(now - 30000), stable: true }, null, { now, windowMs: 10000 })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'stale')
})

test('checkScaleReading:非数字/无时间 → 拒绝', () => {
  const now = 1000000
  assert.equal(checkScaleReading({ value: 'x', at: new Date(now) }, null, { now }).reason, 'no-value')
  assert.equal(checkScaleReading({ value: 5 }, null, { now }).reason, 'stale')
})

test('scaleReadingOf:扁平 points 里取「重量」点位(2026-10-21 的踩坑结构)', () => {
  const r = scaleReadingOf({ data: { deviceCode: 'DZ-001', points: [
    { name: '温度', valueNum: 25, unit: 'C', at: '2026-11-18T09:00:00', status: 'normal' },
    { name: '重量(kg)', valueNum: 0.39, unit: 'kg', at: '2026-11-18T09:00:01', status: 'normal' },
  ] } })
  assert.equal(r.value, 0.39)
  assert.equal(r.stable, true)
  assert.equal(r.deviceCode, 'DZ-001')
})

test('scaleReadingOf:没有点位/没有重量列 → null(页面显示「等待称重」)', () => {
  assert.equal(scaleReadingOf({ data: {} }), null)
  assert.equal(scaleReadingOf(null), null)
})

test('scaleReadingOf:非 normal 状态不算稳定(报警/超限不取值)', () => {
  const r = scaleReadingOf({ points: [{ name: '重量', valueNum: 2, unit: 'kg', status: 'alarm' }] })
  assert.equal(r.value, 2)
  assert.equal(r.stable, false)
})

test('mixProgress:每一行都确认过才可提交', () => {
  const rows = toMixRows(taskLines())
  assert.deepEqual(mixProgress(rows).ok, false)
  assert.equal(mixProgress(rows).total, 2)
  assert.equal(mixProgress(rows).done, 0)
  applyConfirm(rows, { code: 'YJ-TJHZ-001', qty: 86 })
  assert.equal(mixProgress(rows).done, 1)
  assert.deepEqual(mixProgress(rows).missing, ['YJ-YKRS-005'])
  applyConfirm(rows, { code: 'YJ-YKRS-005', qty: 21 })
  assert.equal(mixProgress(rows).ok, true)
  assert.deepEqual(mixProgress(rows).missing, [])
})

test('mixProgress:空清单不算 ok(没有可确认的料也不能提交空单)', () => {
  assert.equal(mixProgress([]).ok, false)
  assert.equal(mixProgress(null).ok, false)
})

test('buildScanPayload:字段名与后端 /px/mix/scan 一致,含 计划用量 与 实际用量', () => {
  const order = { 工单号: 'GD-2026-10-0089', 工单行号: 3, 工单行id: 88, 产品编码: 'A-32-01', 产品名称: '炭棒' }
  const line = { 编码: 'YJ-TJHZ-001', 名称: '雅可比CS', 单位: 'kg', 应投: 226.18 }
  const body = buildScanPayload({ order, line, qty: 226.1849, batch: '20261118001' })
  assert.equal(body.工单号, 'GD-2026-10-0089')
  assert.equal(body.工单行号, 3)
  assert.equal(body.工单行id, 88)
  assert.equal(body.产品编码, 'A-32-01')
  assert.equal(body.物料编号, 'YJ-TJHZ-001')
  assert.equal(body.物料名称, '雅可比CS')
  assert.equal(body.计划用量, 226.18)
  assert.equal(body.实际用量, 226.1849)   // 4 位收敛
  assert.equal(body.物料批次, '20261118001')  // 物料码里的批号要落库(纸面「物料批次」列)
  assert.equal(body.单位, 'kg')
})

test('buildScanPayload:没有行 id 时不下发该字段(后端 longOrNull 会兜底)', () => {
  const body = buildScanPayload({
    order: { 工单号: 'GD-1', 工单行号: 1, 工单行id: 0 },
    line: { 编码: 'M-1', 应投: 1 },
    qty: 1,
  })
  assert.equal(body.工单行id, undefined)
  assert.equal(body.物料批次, '')   // 没扫到码(手输数量)时批次为空,不是 undefined
})

test('buildMixSlipPayload:专用纸表 = 《成型配料记录》横板 A4 的抬头 + 物料行', () => {
  const payload = buildMixSlipPayload({
    docNo: 'PL2611180001',
    data: {
      标题: '成型配料记录',
      文件编码: 'YJ-QR-147',
      单据编号: 'PL2611180001',
      车间: '成型1线',
      产品编号: 'A-45-01',
      配方版本号: '',
      开始时间: '2026-11-18 09:01:02',
      结束时间: '2026-11-18 09:20:00',
      配料批次号: 'PL2611180001',
      配料人: 'admin',
      单据日期: '2026-11-18 09:01:02',
      明细: [{ 物料编号: 'YJ-TJHZ-001', 物料名: '雅可比CS', 添加比例: '18.67%', 应投重量: '86.172', 实投重量: '86.172', 物料批次: '20261118001' }],
    },
  })
  assert.equal(payload.标题, '成型配料记录')
  assert.equal(payload.领料单号, 'PL2611180001')      // 任务单号(打印缓存/站点列表认单)
  assert.equal(payload.打印日期, '2026-11-18')
  assert.equal(payload.纸面.车间, '成型1线')
  assert.equal(payload.纸面.产品编号, 'A-45-01')
  assert.equal(payload.纸面.配料批次号, 'PL2611180001')
  assert.equal(payload.纸面.文件编码, 'YJ-QR-147')
  assert.equal(payload.纸面.序号, 1)
  assert.equal(payload.明细.length, 1)
  assert.equal(payload.明细[0].物料批次, '20261118001')
})

test('buildMixSlipPayload:后端缺字段时给空串/默认抬头(纸表照样画格子)', () => {
  const payload = buildMixSlipPayload({ docNo: 'PL1', data: {} })
  assert.equal(payload.纸面.标题, '成型配料记录')
  assert.equal(payload.纸面.文件编码, 'YJ-QR-147')
  assert.equal(payload.纸面.配料批次号, 'PL1')     // 没有配料批次号就用单号兜
  assert.equal(payload.纸面.车间, '')
  assert.deepEqual(payload.明细, [])
  assert.equal(payload.打印日期, '')
})

test('MIX_PAPER:纸样口径固定(标题/文件编码/横板 A4)', () => {
  assert.equal(MIX_PAPER.标题, '成型配料记录')
  assert.equal(MIX_PAPER.文件编码, 'YJ-QR-147')
  assert.equal(MIX_PAPER.纸张.w, '297mm')
  assert.equal(MIX_PAPER.纸张.h, '210mm')
})

test('扫码混料两个页面(列表 + 明细):每个 tt() 文案都有英文译名', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const en = readFileSync(join(here, '../i18n/locales/en.js'), 'utf8')
  const pages = ['MobileMixScan.vue', 'MobileMixDoc.vue']
  let total = 0
  for (const page of pages) {
    const vue = readFileSync(join(here, '../views/mobile/', page), 'utf8')
    const keys = [...vue.matchAll(/tt\('([^']+)'\)/g)].map((m) => m[1])
    total += keys.length
    const missing = [...new Set(keys)].filter((k) => !en.includes(`'${k}'`) && !en.includes(`"${k}"`))
    assert.deepEqual(missing, [], `${page} 这些文案缺英文译名: ` + missing.join(' / '))
  }
  assert.ok(total > 50, '两个页面的文案不该被抽空')
})

test('扫码混料明细页:扫物料码只解锁(走 scanMaterial),确认才走 scan 落库', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const vue = readFileSync(join(here, '../views/mobile/MobileMixDoc.vue'), 'utf8')
  // 「解锁」与「确认」是两个动作(2026-11-18 第四轮用户口径),别又合并成一个
  assert.match(vue, /\/px\/mix\/scanMaterial/, '扫物料码必须走 /px/mix/scanMaterial(只校验不落库)')
  assert.match(vue, /\/px\/mix\/scan`|'\/px\/mix\/scan'/, '「确认」才走 /px/mix/scan 写入')
  assert.match(vue, /\/px\/mix\/save/, '提交走 /px/mix/save')
  // 全部确认完毕才能提交:按钮按 progress.ok 置灰
  assert.match(vue, /:disabled="!progress\.ok"/, '提交按钮必须按「全部确认完毕」置灰')
  // 秤值要真的被读(不是只显示)
  assert.match(vue, /scaleReadingOf/, '电子秤读数必须参与取数')
})

test('扫码混料扫码:只走 YjNative 桥,不再用 @capacitor-mlkit(手搓壳没装这个原生插件)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = readFileSync(join(here, 'nativeScan.js'), 'utf8')
  // 注释里可以提这个插件(解释事故原因),所以只看去掉注释后的代码
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.match(code, /window\.YjNative\.scan\(\)/, '原生扫码必须调 window.YjNative.scan()')
  assert.match(code, /__yjScanResult/, '结果由壳回调 window.__yjScanResult(code, ok)')
  // 手搓壳里没有这个原生实现,一调必抛 "This plugin method is not available on this platform."
  assert.doesNotMatch(code, /@capacitor-mlkit/, 'ML Kit 插件不该再被引入')
  assert.doesNotMatch(code, /BarcodeScanner/, '不该再调 BarcodeScanner.*')
})
