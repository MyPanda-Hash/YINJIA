/**
 * sinterRowAlias.test.js —— 两块面板合并后，配方计算仍按老键名取数（2026-10-30）
 *
 * 背景：旧的「烧结尺寸表 RD_SINTER_TOL」已撤掉，模具维护只剩「生产模具表 PROD_MOLD」
 * （同一张物理表 rd_sinter_tolerance，但列名改成了用户口径：炭棒尺寸 / 外模规格 / …）。
 * 配方计算那一侧一直按物理列名（型号 / 模具尺寸 / 炭棒外径 / 长度范围 / 停用）取值，
 * 所以 sinterRowsFromQuery 里加了一层键名归一化 —— 这层是"合并没把计算器弄坏"的唯一保障，
 * 必须钉住：新键 → 老键、只补缺不覆盖、停用照旧过滤。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSinterRow, sinterRowsFromQuery, sinterRowsForWorkshop } from './recipeSheet.js'

/** PROD_MOLD 面板真实返回的行（键是用户口径的 label） */
const newRow = () => ({
  车间: '1', 炭棒尺寸: '45*25', 外模规格: '45', 中心杆规格: '25',
  炭棒外径尺寸: '44.5', 炭棒外径公差: '±0.5', 炭棒内径尺寸: '24.5', 炭棒内径公差: '±0.5',
  可生产炭棒长度范围: '10-300', 模具数量: 2, 停用: false,
})

test('① 新列名补回老键名（型号/模具尺寸/中心杆尺寸/炭棒外径/炭棒内径/长度范围）', () => {
  const r = normalizeSinterRow(newRow())
  assert.equal(r.型号, '45*25')
  assert.equal(r.模具尺寸, '45')
  assert.equal(r.中心杆尺寸, '25')
  assert.equal(r.炭棒外径, '44.5')
  assert.equal(r.炭棒内径, '24.5')
  assert.equal(r.长度范围, '10-300')
  // 原键保留（面板自己要显示）
  assert.equal(r.炭棒尺寸, '45*25')
})

test('② 只补缺不覆盖：同时存在两个名字时以老键为准', () => {
  const r = normalizeSinterRow({ 炭棒尺寸: '新值', 型号: '老值' })
  assert.equal(r.型号, '老值')
})

test('③ 值是真值(0/空)时也要能补上 —— 只看"有没有"不看真假', () => {
  const r = normalizeSinterRow({ 炭棒尺寸: '40*20', 型号: '' })
  assert.equal(r.型号, '40*20')
})

test('④ 停用照旧过滤：停用的模具不进配方计算候选', () => {
  const data = { data: [{ detail: { items: [
    { ...normalizeSinterRow(newRow()) }, // 正常
    { ...normalizeSinterRow({ ...newRow(), 车间: '3', 炭棒尺寸: '50*25' }), 停用: true },
  ] } }] }
  const rows = sinterRowsFromQuery(data)
  assert.equal(rows.length, 1, '停用那条必须被剔除')
  assert.equal(rows[0].型号, '45*25')
  assert.equal(rows[0].炭棒外径, '44.5', '归一化发生在过滤之前，老键名已就位')
})

test('⑤ 按车间挑行仍走老口径（车间 1/3 这种共享写法拆开匹配）', () => {
  const rows = sinterRowsFromQuery({ data: [{ detail: { items: [
    normalizeSinterRow({ ...newRow(), 车间: '1/3', 炭棒尺寸: '45*25' }),
    normalizeSinterRow({ ...newRow(), 车间: '4', 炭棒尺寸: '80*35' }),
  ] } }] })
  assert.equal(sinterRowsForWorkshop(rows, '3').length, 1)
  assert.equal(sinterRowsForWorkshop(rows, '3')[0].型号, '45*25')
  assert.equal(sinterRowsForWorkshop(rows, '4')[0].型号, '80*35')
})

test('⑥ 脏输入不炸', () => {
  for (const bad of [null, undefined, {}, { data: [] }, { data: {} }, { list: [{}, {}] }]) {
    assert.doesNotThrow(() => sinterRowsFromQuery(bad))
  }
  assert.equal(normalizeSinterRow(null), null)
})
