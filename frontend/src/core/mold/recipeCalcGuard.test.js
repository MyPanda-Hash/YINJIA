import test from 'node:test'
import assert from 'node:assert/strict'
import { paramsFromHead, slotsFromRows, unfilledDesignRows } from './recipeSheet.js'

/**
 * 配方计算的三道输入闸(2026-10-15 用户报障):
 *   A. 参与计算的行没填「设计添加量」⇒ 静默按 0 算,必须点名告警(按引擎真实料位语义判,不误伤料位 1 补差位);
 *   B. 配方表 0 行 ⇒ 根本无法计算,必须阻断(与「缺外径/内径/长度/密度」同级);
 *   C. 「选产品编号」带出的炭棒规格格是 `外：56.5`/`长：250` 这种**带前缀**文本(carbonSpec.js 的落格格式),
 *      直接 parseNumber 得到 NaN —— 外径/内径另有 外径mm/内径mm 兜底,长度没有,于是"补上长度"永远补不上。
 * 期望值全部按"引擎真正吃到的数"写,不照实现反填。
 */

/** 造一行配方表(照单据里真实的数据键) */
const row = (kind, code, design) => ({ 表区: '配方表', 序号: '', 物料种类: kind, 物料编号: code, 物料名称: code, 设计添加量: design })
/** 尺寸/密度齐全的单据头(只留尺寸这一条变量) */
const headOK = { 炭棒规格1: '59.5', 炭棒规格2: '39.5', 炭棒规格3: '120', 实际密度管控下限: '0.58', 实际密度管控上限: '0.60' }
const OPTS = { cavities: 1, conversion_ratio: 0.5 }

test('C:带 `外：/内：/长：` 前缀的炭棒规格格照样解析出尺寸(长度从前就栽在这)', () => {
  const { params, missing } = paramsFromHead({
    炭棒规格1: '外：56.5', 炭棒规格2: '内：29.5', 炭棒规格3: '长：250',
    实际密度管控下限: '0.58', 实际密度管控上限: '0.60',
  }, OPTS)
  // 修前:od/id 靠 外径mm/内径mm 兜底(单据上没有 ⇒ 也是 null),length 恒 null ⇒ missing 里挂着「外径、内径、长度」
  assert.deepEqual(missing, [])
  assert.equal(params.od, 56.5)
  assert.equal(params.id, 29.5)
  assert.equal(params.length, 250)
})

test('C:规格格里只有前缀、没有数字 ⇒ 仍按缺项拦,不猜一个长度出来', () => {
  const { params, missing } = paramsFromHead({
    炭棒规格1: '外：', 炭棒规格2: '内：29.5', 炭棒规格3: '长：',
    实际密度管控下限: '0.58', 实际密度管控上限: '0.60',
  }, OPTS)
  assert.equal(params.od, null)
  assert.equal(params.length, null)
  assert.equal(params.id, 29.5)
  assert.ok(missing.includes('外径'), missing.join('|'))
  assert.ok(missing.includes('长度'), missing.join('|'))
})

test('B:配方表 0 行(或整行空白)⇒ 报阻断项,与缺尺寸密度同级', () => {
  const none = paramsFromHead(headOK, OPTS, [])
  assert.ok(none.missing.includes('配方表物料行'), none.missing.join('|'))
  const blank = paramsFromHead(headOK, OPTS, [{ 表区: '配方表', 物料种类: '', 物料编号: '', 物料名称: '', 设计添加量: '' }])
  assert.ok(blank.missing.includes('配方表物料行'), blank.missing.join('|'))
})

test('B:有物料行就不阻断 —— 「填了行但没填设计添加量」走告警,不在这里拦', () => {
  const one = paramsFromHead(headOK, OPTS, [row('炭粉', 'A', '')])
  assert.deepEqual(one.missing, [])
  assert.equal(one.params.length, 120)
  assert.equal(slotsFromRows([row('炭粉', 'A', '')]).slots.length, 10)
})

/* ── A:参与计算的行没填「设计添加量」⇒ 静默按 0 算(实测:两行折算料全空,照样回填 0.00% 与页 1 十一格) ── */

/** 「要填的行」= 在配方表里真有物料、且**引擎真的吃这一行的值**的那些行 */
test('A:没填「设计添加量」的行被点名(按行号),料位 1 补差位不点名', () => {
  const rows = [
    row('炭粉', 'A', ''),               // 料位 1 = 补差位(1 − Σ料位2~7),这行的值本来就不参与 ⇒ 不点名
    row('炭粉', 'B', ''),               // 料位 2:空 ⇒ 按 0 算,点名
    row('胶粉', 'C', '0.5'),            // 填了,不点名
    row('功能料-颗粒', 'M-001', ''),    // 料位 8(折算料,克/支):空 ⇒ 按 0 算,点名
    row('功能料-颗粒', 'M-003', ''),    // 料位 9:同上
  ]
  const { slots } = slotsFromRows(rows)
  assert.deepEqual(unfilledDesignRows(rows, slots), [2, 4, 5])
})

test('A:显式填 0 是"这个料不用",不算没填;填了乱码算没填;没有物料的空行也不点名', () => {
  const rows = [
    row('炭粉', 'A', '1'),              // 料位 1 补差位
    row('炭粉', 'B', '0'),              // 显式 0 ⇒ 人有意为之,不点名
    row('炭粉', 'C', 'abc'),            // 不是数字 ⇒ 引擎也按 0 算 ⇒ 点名
    { 表区: '配方表', 序号: '', 物料种类: '炭粉', 物料编号: '', 物料名称: '', 设计添加量: '' },  // 料位 4:没物料 ⇒ 空行,不点名
    row('胶粉', 'D', '0.5'),
    row('功能料-颗粒', 'M-001', '2.5'),  // 折算料填了克/支
    row('功能料-颗粒', 'M-003', ''),
  ]
  const { slots } = slotsFromRows(rows)
  assert.deepEqual(unfilledDesignRows(rows, slots), [3, 7])
})

test('A:没有配方表行时,这条告警为空(0 行由 B 的阻断项管,别重复喊)', () => {
  const { slots } = slotsFromRows([])
  assert.deepEqual(unfilledDesignRows([], slots), [])
  assert.deepEqual(unfilledDesignRows([], undefined), [])
  assert.deepEqual(unfilledDesignRows(null, slots), [])
})
