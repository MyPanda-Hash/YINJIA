/**
 * docRailDetail 单测 —— 左栏「明细派生列」的唯一真源(2026-11-20)。
 *
 * 守什么:
 *   ① 来料检验单左栏由「供应商」换成「物料编码 + 物料名称」,而这两格**只能**从明细派生
 *      (qc_insp 头表没有这两列,写裸字符串列 = 永远空白);
 *   ② 一张单多物料 ⇒ 去重后并排;分割符不带中文(外语界面不能夹中文);
 *   ③ 明细缺失/空值不炸(接口降级、老单据)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detailRailColumn, detailRailText } from './docRailDetail.js'

const rowWith = (items) => ({ 编号: 'IJ-1', detail: { items } })

test('单物料:物料编码/物料名称直接取明细值', () => {
  const row = rowWith([{ 物料编码: 'YJ-XH-001', 物料名称: '鑫恒 80-250', 送检数量: 1800 }])
  assert.equal(detailRailText(row, '物料编码'), 'YJ-XH-001')
  assert.equal(detailRailText(row, '物料名称'), '鑫恒 80-250')
})

test('多物料:去重 + 明细行序 + " / " 分隔(不夹中文连接词)', () => {
  const row = rowWith([
    { 物料编码: 'A-1', 物料名称: '甲' },
    { 物料编码: 'B-2', 物料名称: '乙' },
    { 物料编码: 'A-1', 物料名称: '甲' },
  ])
  assert.equal(detailRailText(row, '物料编码'), 'A-1 / B-2')
  assert.equal(detailRailText(row, '物料名称'), '甲 / 乙')
})

test('空明细 / 缺 detail / 空键值 / 空键名 ⇒ 空串(左栏留空,不显示占位)', () => {
  assert.equal(detailRailText(null, '物料编码'), '')
  assert.equal(detailRailText({}, '物料编码'), '')
  assert.equal(detailRailText({ detail: {} }, '物料编码'), '')
  assert.equal(detailRailText(rowWith([]), '物料编码'), '')
  assert.equal(detailRailText(rowWith([{ 物料编码: '  ' }, {}]), '物料编码'), '')
  assert.equal(detailRailText(rowWith([{ 物料编码: 'A-1' }]), ''), '')
})

test('detailRailColumn 产出标准列对象(derive 供 DocSelectRail 取值)', () => {
  const col = detailRailColumn('物料编码')
  assert.equal(col.label, '物料编码')
  assert.equal(col.align, 'left')
  assert.equal(typeof col.derive, 'function')
  assert.equal(col.derive(rowWith([{ 物料编码: 'YJ-XH-001' }])), 'YJ-XH-001')
  assert.equal(col.derive(null), '')
})

test('PanelxList 接线:来料检验单左栏不含供应商,制程单中间列换成产品编码', () => {
  const src = readFileSync(new URL('../views/PanelxList.vue', import.meta.url), 'utf8')
  const start = src.indexOf('const DOC_RAIL_PANELS = {')
  assert.notEqual(start, -1, 'PanelxList 里找不到 DOC_RAIL_PANELS')
  const end = src.indexOf('\n}', start)
  const block = src.slice(start, end)
  const lineOf = (code) => {
    const m = block.match(new RegExp('^ {2}' + code + ':[\\s\\S]*?\\n {2}[A-Z][A-Z0-9_]*:', 'm'))
    assert.ok(m, `DOC_RAIL_PANELS 里找不到 ${code} 的配置`)
    return m[0]
  }
  const insp = lineOf('QC_INSP')
  assert.match(insp, /detailRailColumn\('物料编码'\)/, '来料检验单左栏要有物料编码')
  assert.match(insp, /detailRailColumn\('物料名称'\)/, '来料检验单左栏要有物料名称')
  assert.ok(!insp.includes("'供应商'"), '来料检验单左栏不再显示供应商')
  // 2026-11-20 用户口径「出货检验(功能)不需要显示产品名称修改为产品编码」
  const proc = lineOf('QC_PROC_INSP')
  assert.match(proc, /QC_PROC_INSP:\s*\['工单号',\s*'产品编码'\]/)
})
