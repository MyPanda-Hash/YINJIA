/**
 * mobileReturn.test.js — 生产退料明细页的纯逻辑单测(2026-11-18 第四轮)
 *
 * 每条断言都指向具体业务口径:
 *   · toReturnRows   → 可退 = 已领 − 已退(累计,分批退),缺字段不炸
 *   · applyReturn    → **覆盖**写入、超退必须拒(不猜)、不在本单的行拒
 *   · returnProgress → 提交闸门 = 至少一项(退料是部分退,不要求每行都退)
 *   · 页面静态检查   → 明细页文案都有英文译名;扫物料走 returnScan,提交走 submitReturn
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  toReturnRows,
  applyReturn,
  clearReturnQty,
  returnProgress,
} from './mobileReturn.js'

/** 后端 /px/mobilePick/doc 的 领料明细 形状(已退数量由服务端按 wo_pick_return 算好) */
const docLines = () => ([
  { 行号: '1', 编码: 'YJ-TJHZ-001', 名称: '雅可比CS(80-200)', 规格: '粉料', 单位: 'kg', 批号: '20261118001', 数量: 86.172, 已退数量: 0 },
  { 行号: '2', 编码: 'YJ-YKRS-005', 名称: '英克瑞斯椰壳活性炭', 规格: '粉料', 单位: 'kg', 批号: '20261118002', 数量: 21.042, 已退数量: 10 },
])

test('toReturnRows:可退 = 已领 − 已退(已退过的行只剩余量)', () => {
  const rows = toReturnRows(docLines())
  assert.equal(rows.length, 2)
  assert.equal(rows[0].编码, 'YJ-TJHZ-001')
  assert.equal(rows[0].已领, 86.172)
  assert.equal(rows[0].已退, 0)
  assert.equal(rows[0].可退, 86.172)
  assert.equal(rows[0].本次退, 0)
  // 第 2 行已退过 10 ⇒ 可退只剩 11.042
  assert.equal(rows[1].已退, 10)
  assert.equal(rows[1].可退, 11.042)
})

test('toReturnRows:已退 ≥ 已领 时可退按 0(不出现负数)', () => {
  const rows = toReturnRows([{ 编码: 'M-1', 数量: 5, 已退数量: 5 }])
  assert.equal(rows[0].可退, 0)
  const over = toReturnRows([{ 编码: 'M-1', 数量: 5, 已退数量: 7 }])
  assert.equal(over[0].可退, 0)
})

test('toReturnRows:空/缺字段不炸(页面按空明细走)', () => {
  assert.deepEqual(toReturnRows(null), [])
  assert.deepEqual(toReturnRows([]), [])
  const row = toReturnRows([{}])[0]
  assert.equal(row.编码, '')
  assert.equal(row.可退, 0)
  assert.equal(row.本次退, 0)
})

test('applyReturn:确认 = 覆盖写入(同一物料再确认以最后一次为准)', () => {
  const rows = toReturnRows(docLines())
  assert.equal(applyReturn(rows, { code: 'YJ-TJHZ-001', qty: 10 }).ok, true)
  assert.equal(rows[0].本次退, 10)
  applyReturn(rows, { code: 'YJ-TJHZ-001', qty: 20 })
  assert.equal(rows[0].本次退, 20)   // 覆盖,不是 30
})

test('applyReturn:超过可退 ⇒ over,且不改动该行', () => {
  const rows = toReturnRows(docLines())
  const r = applyReturn(rows, { code: 'YJ-YKRS-005', qty: 12 })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'over')
  assert.equal(rows[1].本次退, 0)
  // 正好等于可退 ⇒ 允许
  assert.equal(applyReturn(rows, { code: 'YJ-YKRS-005', qty: 11.042 }).ok, true)
})

test('applyReturn:数量 <=0 或非数字 ⇒ no-qty;不在本单 ⇒ miss', () => {
  const rows = toReturnRows(docLines())
  assert.equal(applyReturn(rows, { code: 'YJ-TJHZ-001', qty: 0 }).reason, 'no-qty')
  assert.equal(applyReturn(rows, { code: 'YJ-TJHZ-001', qty: -1 }).reason, 'no-qty')
  assert.equal(applyReturn(rows, { code: 'YJ-TJHZ-001', qty: 'abc' }).reason, 'no-qty')
  assert.equal(applyReturn(rows, { code: 'X-999', qty: 1 }).reason, 'miss')
})

test('returnProgress:部分退也算数(不要求每行都退)', () => {
  const rows = toReturnRows(docLines())
  assert.equal(returnProgress(rows).ok, false)          // 什么都没填
  assert.equal(returnProgress(rows).total, 2)
  assert.equal(returnProgress(rows).canTotal, 97.214)   // 86.172 + 11.042

  applyReturn(rows, { code: 'YJ-YKRS-005', qty: 11 })
  const p = returnProgress(rows)
  assert.equal(p.ok, true)            // 只退一项也允许提交
  assert.equal(p.done, 1)
  assert.equal(p.totalQty, 11)
  assert.deepEqual(p.items, [{ code: 'YJ-YKRS-005', qty: 11 }])
})

test('returnProgress:合计 = 各项之和(4 位小数)', () => {
  const rows = toReturnRows(docLines())
  applyReturn(rows, { code: 'YJ-TJHZ-001', qty: 86.172 })
  applyReturn(rows, { code: 'YJ-YKRS-005', qty: 11.042 })
  const p = returnProgress(rows)
  assert.equal(p.done, 2)
  assert.equal(p.totalQty, 97.214)
  assert.deepEqual(p.items.map((x) => x.code), ['YJ-TJHZ-001', 'YJ-YKRS-005'])
})

test('clearReturnQty:本次退全部归 0,已领/已退/可退不动', () => {
  const rows = toReturnRows(docLines())
  applyReturn(rows, { code: 'YJ-TJHZ-001', qty: 5 })
  clearReturnQty(rows)
  assert.equal(rows[0].本次退, 0)
  assert.equal(rows[0].已领, 86.172)
  assert.equal(returnProgress(rows).ok, false)
})

test('生产退料明细页:文案都有英文译名 + 扫料解锁/提交走对接口', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const vue = readFileSync(join(here, '../views/mobile/MobileReturnDoc.vue'), 'utf8')
  const en = readFileSync(join(here, '../i18n/locales/en.js'), 'utf8')
  const keys = [...vue.matchAll(/tt\('([^']+)'\)/g)].map((m) => m[1])
  assert.ok(keys.length > 25, '明细页文案不该被抽空')
  const missing = [...new Set(keys)].filter((k) => !en.includes(`'${k}'`) && !en.includes(`"${k}"`))
  assert.deepEqual(missing, [], '这些文案缺英文译名: ' + missing.join(' / '))

  // 扫物料码只解锁(/returnScan),提交才落库(/submitReturn)—— 与生产领料、扫码混料同一套
  assert.match(vue, /\/px\/mobilePick\/returnScan/, '扫物料码必须走 /returnScan(只取可退量)')
  assert.match(vue, /\/px\/mobilePick\/submitReturn/, '提交必须走 /submitReturn')
  assert.match(vue, /\/px\/mobilePick\/doc/, '明细页取数必须走 /doc(抬头 + 领料明细)')
  assert.match(vue, /:disabled="!progress\.ok"/, '提交按钮必须按「本次退料合计>0」置灰')
})
