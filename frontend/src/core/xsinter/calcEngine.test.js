/**
 * calcEngine.test.js —— X烧结配方计算引擎的验收基准  2026-10-30
 *
 * 【数据来源】真实单据《T205-X冰箱炭棒-26102901.xlsx》的**缓存值**（Excel 已算好的结果），
 * 不是我自己推的 —— 引擎必须逐格复现它，否则就是算错。
 *
 * 取数位置（设计模板与本单据同一张表结构）：
 *   配方计算器!E4/F4/G4 = 30 / 12 / 116     炭棒外径/内径/出货长度
 *   配方计算器!C6/D6    = 30.5 / 13         模具出料口/中心杆
 *   配方计算器!H6/I6    = 0.65 / 0.5        折算系数/成型修正长度
 *   配方计算器!J6/K6    = 0.55 / 0.64       密度下限/上限
 *   配方计算器!E9:E18   = 设计添加量 10 行
 *
 * 期望值（Excel 算出来的，逐条抄自 T205 文件）：
 *   J8  切割长度中间值 116.5      K8 炭棒体积 69.13809
 *   I10 重量下限 38.0259495       J10 重量中间值 41.13716355   K10 重量上限 44.2483776
 *   F19 单支总重 41.13716355      H9..H18 单支含量（见下）
 *   打印模板 C27/E27/I27 = 116 / 116.5 / 117          成型切炭长度
 *   打印模板 C29/E29/I29 = 115.5 / 116 / 116.5        成型冷却长度
 *   打印模板 C33/E33/I33 = 0.55 / 0.595 / 0.64        密度要求
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { computeXsinter, problemsOf, ROW_KINDS } from './calcEngine.js'

/** T205 的输入 */
const T205 = {
  rodOuter: 30,
  rodInner: 12,
  shipLength: 116,
  dieOutlet: 30.5,
  rodDiameter: 13,
  granuleFactor: 0.65,
  lengthFix: 0.5,
  densLow: 0.55,
  densHigh: 0.64,
  // 粉料1..5 / 胶粉1..2 / 颗粒料1..3（粉料1 由 1 倒推，传 0 也会被覆盖）
  designs: [0, 0.265, 0.02, 0, 0, 0.45, 0, 0, 0, 0],
}

const near = (a, b, tol = 1e-5) => Math.abs(a - b) <= tol

test('① 切割长度中间值 = 出货长度 + 成型修正长度参数（Excel J8）', () => {
  assert.equal(computeXsinter(T205).cutMid, 116.5)
})

test('② 炭棒体积 = (外径²−内径²)/4000 × 3.14 × 切割长度（Excel K8）', () => {
  // ((900-144)/4000)*3.14*116.5
  const v = computeXsinter(T205).volume
  assert.ok(near(v, 69.13809), `体积 ${v}，期望 69.13809`)
})

test('③ 单支重量三档 = 体积 × 密度（Excel I10/J10/K10）', () => {
  const r = computeXsinter(T205)
  assert.ok(near(r.weight.low, 38.0259495), `下限 ${r.weight.low}`)
  assert.ok(near(r.weight.mid, 41.13716355), `中间 ${r.weight.mid}`)
  assert.ok(near(r.weight.high, 44.2483776), `上限 ${r.weight.high}`)
})

test('④ 粉料1 由 1 倒推（Excel E9 = 1 − ΣE10:E15），不是手填', () => {
  const r = computeXsinter(T205)
  const row1 = r.rows[0]
  assert.equal(row1.kind, '粉料1')
  // 1 − (0.265 + 0.02 + 0.45) = 0.265 —— 与 Excel E9 一致
  assert.ok(near(row1.design, 0.265), `粉料1 设计添加量 ${row1.design}，期望 0.265`)
  // 故意把粉料1 传成 9，结果仍应是倒推值（传参被忽略）
  const r2 = computeXsinter({ ...T205, designs: [9, 0.265, 0.02, 0, 0, 0.45, 0, 0, 0, 0] })
  assert.ok(near(r2.rows[0].design, 0.265), '粉料1 必须被倒推覆盖')
})

test('⑤ 单支总重 = Σ(比例×中间值) + Σ(颗粒料克数) − 折算量（Excel F19）', () => {
  const r = computeXsinter(T205)
  assert.ok(near(r.totalWeight, 41.13716355), `单支总重 ${r.totalWeight}`)
  assert.equal(r.convWeight, 0, '本例没有颗粒料，折算量应为 0')
})

test('⑥ 各物料单支含量 = 实际比例 × 单支总重（Excel H9:H18）', () => {
  const r = computeXsinter(T205)
  const byKind = Object.fromEntries(r.rows.map((x) => [x.kind, x]))
  assert.ok(near(byKind['粉料1'].perPiece, 10.90134834075), `粉料1 ${byKind['粉料1'].perPiece}`)
  assert.ok(near(byKind['粉料2'].perPiece, 10.90134834075), `粉料2 ${byKind['粉料2'].perPiece}`)
  assert.ok(near(byKind['粉料3'].perPiece, 0.822743271), `粉料3 ${byKind['粉料3'].perPiece}`)
  assert.ok(near(byKind['胶粉1'].perPiece, 18.5117235975), `胶粉1 ${byKind['胶粉1'].perPiece}`)
  // 四行含量合计 = 单支总重
  const sum = r.rows.reduce((a, x) => a + x.perPiece, 0)
  assert.ok(near(sum, r.totalWeight), `含量合计 ${sum} 应等于总重 ${r.totalWeight}`)
})

test('⑦ 比例合计 = 1（Excel G19）', () => {
  const r = computeXsinter(T205)
  assert.ok(near(r.totalRatio, 1), `比例合计 ${r.totalRatio}`)
})

test('⑧ 纸面「成型切炭长度」三档 = 中间值 ∓ 修正长度（打印模板 C27/E27/I27）', () => {
  const r = computeXsinter(T205)
  assert.deepEqual([r.cut.low, r.cut.mid, r.cut.high], [116, 116.5, 117])
})

test('⑨ 纸面「成型冷却长度」三档 = 切炭三档 − 修正长度（打印模板 C29/E29/I29）', () => {
  const r = computeXsinter(T205)
  assert.deepEqual([r.cool.low, r.cool.mid, r.cool.high], [115.5, 116, 116.5])
})

test('⑩ 纸面「密度要求」三档 = 下限 / 中值 / 上限（打印模板 C33/E33/I33）', () => {
  const r = computeXsinter(T205)
  assert.ok(near(r.density.low, 0.55))
  assert.ok(near(r.density.mid, 0.595))
  assert.ok(near(r.density.high, 0.64))
})

test('⑪ 颗粒料按**克数**直接计入（不乘单支重量）—— 这是 X烧结与旧引擎最大的差异', () => {
  // 只有颗粒料：设计 1.5g + 2.5g，其余为 0（粉料1 会倒推成 1）
  const r = computeXsinter({
    rodOuter: 30, rodInner: 12, shipLength: 100,
    granuleFactor: 0.65, lengthFix: 0, densLow: 0.5, densHigh: 0.5,
    designs: [0, 0, 0, 0, 0, 0, 0, 1.5, 2.5, 0],
  })
  // 折算量 = 0.65 × (1.5+2.5) = 2.6
  assert.ok(near(r.convWeight, 2.6), `折算量 ${r.convWeight}`)
  // 颗粒料 4.0 直接加；粉料1 倒推为 1 → 粉料合计 = 体积×0.5×1 − 2.6
  const powder = r.volume * 0.5 * 1 - 2.6
  assert.ok(near(r.totalWeight, powder + 4.0), `总重 ${r.totalWeight}，期望 ${powder + 4.0}`)
})

test('⑫ 物料行顺序与 Excel 一致（固定 10 行）', () => {
  assert.deepEqual([...ROW_KINDS], [
    '粉料1', '粉料2', '粉料3', '粉料4', '粉料5',
    '胶粉1', '胶粉2', '颗粒料1', '颗粒料2', '颗粒料3',
  ])
  assert.equal(computeXsinter(T205).rows.length, 10)
})

test('⑬ problemsOf：缺关键输入时给出人话原因（不是静默算 0）', () => {
  assert.deepEqual(problemsOf({}).length > 0, true)
  assert.ok(problemsOf({ ...T205, rodOuter: 12, rodInner: 12 }).some((s) => s.includes('必须大于内径')))
  assert.ok(problemsOf({ ...T205, densLow: 0.7, densHigh: 0.6 }).some((s) => s.includes('下限不能大于上限')))
  assert.ok(problemsOf({ ...T205, designs: [0, 0.5, 0.5, 0, 0, 0.5, 0, 0, 0, 0] })
    .some((s) => s.includes('超过 100%')))
  assert.deepEqual(problemsOf(T205), [], 'T205 这组输入应当无问题')
})

test('⑭ 空/脏输入不抛错、不返回 NaN（纸面刚建单时的常态）', () => {
  for (const bad of [{}, { rodOuter: '' }, { rodOuter: 'a', rodInner: null, designs: [] },
    { rodOuter: 30, rodInner: 12, shipLength: 116, designs: [1, 2, 3] }]) {
    const r = computeXsinter(bad)
    for (const k of ['cutMid', 'volume', 'totalWeight', 'totalRatio']) {
      assert.ok(Number.isFinite(r[k]), `${k} 应是有限数，实际 ${r[k]}`)
    }
    assert.equal(r.rows.length, 10)
  }
})
