import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compute } from './recipeEngine.js'
import {
  ENGINE_VERSION, PI, VOLUME_DIVISOR, BLANK_LENGTH_BASE, BLANK_LENGTH_PER_CAVITY,
  DEFAULT_LENGTH_TOL, POWDER_SLOTS, GLUE_SLOTS, CONVERTED_SLOTS, STRATEGY_LEGACY,
} from './recipeConstants.js'

/**
 * 配方计算引擎的验收:与《炭棒工艺配方设计器》exe 的 app.domain.engine **逐位一致**。
 *
 * 期望值不是照文档推的,是把 exe 里的真引擎(PyInstaller 归档 → PYZ → app.domain.engine)
 * 取出来跑出来的,固化在 __fixtures__/ 下:
 *   - recipeHistory.json  24 条 calc_history 真实记录(用户当年用 exe 算过的单)
 *   - recipeGolden.json   边界 23 例 + 定种子随机 62 例(含全部 7 种告警文案)
 * 复现命令(需要 Python 3.10):
 *   uv run --python 3.10 --with pyinstaller python tools/archive/_gen-recipe-golden.py
 *
 * 比对口径是 **===**(不是近似):同一个 double 由同一串运算顺序得出才敢这么比,
 * 所以引擎里每个表达式的运算次序都与 Python 逐条对齐,改动必须重跑本文件。
 */
const fixture = (name) => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8'))

/** 逐位比对:字段集一致 + 每个数字 ===(数组逐元素、对象逐键、告警逐条) */
function assertExact(actual, expected, label) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${label}:结果字段集应一致`)
  for (const key of Object.keys(expected)) {
    const want = expected[key]
    const got = actual[key]
    if (Array.isArray(want)) {
      assert.ok(Array.isArray(got), `${label}.${key} 应为数组`)
      assert.equal(got.length, want.length, `${label}.${key} 长度`)
      want.forEach((v, i) => assert.equal(got[i], v, `${label}.${key}[${i}]`))
    } else if (want !== null && typeof want === 'object') {
      assert.deepEqual(Object.keys(got).sort(), Object.keys(want).sort(), `${label}.${key} 键集应一致`)
      for (const inner of Object.keys(want)) assert.equal(got[inner], want[inner], `${label}.${key}.${inner}`)
    } else {
      assert.equal(got, want, `${label}.${key}`)
    }
  }
}

/** 造一个料位:粉料/胶粉给 design_ratio,折算料给 amount_g;moisture 可为 null */
const slot = ({ ratio = null, amount = null, moisture = null } = {}) => {
  const item = { moisture }
  if (ratio !== null) item.design_ratio = ratio
  if (amount !== null) item.amount_g = amount
  return item
}

const recipe = ({ powder = [0.62, 0, 0, 0, 0], glue = [0.33, 0.05], conv = [0, 0, 0], moist = 0.06 } = {}) => [
  ...powder.map((r) => slot({ ratio: r, moisture: moist })),
  ...glue.map((r) => slot({ ratio: r })),
  ...conv.map((a) => slot({ amount: a, moisture: moist })),
]

const params = (over = {}) => ({
  od: 45, id: 30, length: 200, cavities: 1,
  density_low: 1.2, density_high: 1.4, conversion_ratio: 0.5,
  length_tol_low: 2.5, length_tol_high: 2.5,
  demold_low_factor: 1.0, demold_high_factor: 1.0,
  ...over,
})

/** 历史记录专用比对:result 是**历史版本引擎**写下的,口径与当前一致但回显键名有别 ——
 *  1~19 号是旧构建(exe 在 2026-09-17 17:19 前后重编过一次),params 回显的是老单键 `length_tol`;
 *  20~24 号是当前构建,回显 `length_tol_low/high`。数值口径两者一致(已逐字段核对),
 *  故这里先把公差键名归一化再逐位比对,不做"改测试迁就实现"的让步。 */
function assertSameAsStored(got, stored, label) {
  const expected = { ...stored, params: { ...stored.params } }
  if (expected.params.length_tol !== undefined && expected.params.length_tol_low === undefined) {
    expected.params.length_tol_low = expected.params.length_tol
    expected.params.length_tol_high = expected.params.length_tol
    delete expected.params.length_tol
  }
  assertExact(got, expected, label)
}

/** 递归确认结果里没有任何 NaN/Infinity(除零护栏失效时最典型的症状) */
function assertAllFinite(value, path = '结果') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} 出现非有限值 ${value}`)
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertAllFinite(v, `${path}[${i}]`))
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) assertAllFinite(value[key], `${path}.${key}`)
  }
}

test('常量与 exe 一致:π 取 3.14、体积除数 4000、料头 10+3×腔数', () => {
  assert.equal(ENGINE_VERSION, '1.0.0')
  assert.equal(PI, 3.14)
  assert.equal(VOLUME_DIVISOR, 4000)
  assert.equal(BLANK_LENGTH_BASE, 10)
  assert.equal(BLANK_LENGTH_PER_CAVITY, 3)
  assert.equal(DEFAULT_LENGTH_TOL, 2.5)
  assert.equal(STRATEGY_LEGACY, 'LEGACY')
  assert.deepEqual(POWDER_SLOTS, [0, 1, 2, 3, 4])
  assert.deepEqual(GLUE_SLOTS, [5, 6])
  assert.deepEqual(CONVERTED_SLOTS, [7, 8, 9])
})

/* ── 黄金向量:exe 真引擎的期望值 ── */

test('黄金向量:24 条 calc_history 真实记录逐位复现', () => {
  const history = fixture('recipeHistory.json')
  assert.equal(history.length, 24)
  for (const record of history) {
    const got = compute(record.params, record.recipe)
    assertSameAsStored(got, record.result, `历史#${record.id}`)
  }
})

test('黄金向量:边界 23 例 + 随机 62 例逐位一致(含全部 5 类告警)', () => {
  const golden = fixture('recipeGolden.json')
  assert.equal(golden.length, 85)
  const texts = new Set()
  for (const c of golden) {
    const got = compute(c.params, c.recipe)
    assertExact(got, c.result, c.name)
    ;(c.result.warnings || []).forEach((w) => texts.add(w.replace(/[\d.]+/g, 'N')))
  }
  assert.deepEqual([...texts].sort(), [
    'N~N 位设计比例合计为 N ≠ N，请检查配方配平',
    '密度下限大于上限，请检查密度管控范围',
    '折算比应在 N~N 之间',
    '料位 N 添加比例为负（折算料投加量超过总量），请复核折算料用量',
    '料位 N 水分未采集，按 N 计，请补充含水率',
  ].sort(), `告警文案集应完全一致,实际:${[...texts].join(' | ')}`)
})

/* ── 关键公式单独钉死:黄金向量挂了也知道挂在哪一条 ── */

test('成型长度标准 = 腔数×(长度+3)+10,公差上下限各自加减', () => {
  assert.deepEqual(compute(params({ length: 200, cavities: 1 }), recipe()).lengths, { low: 210.5, std: 213, high: 215.5 })
  assert.deepEqual(compute(params({ length: 120, cavities: 2 }), recipe()).lengths, { low: 253.5, std: 256, high: 258.5 })
  assert.deepEqual(compute(params({ length: 0, cavities: 1 }), recipe()).lengths, { low: 10.5, std: 13, high: 15.5 })
  // 非对称公差:断言写成运算式而不是手抄小数,避免"抄错一个 ulp"变成假失败
  const asym = compute(params({ length: 200, length_tol_low: 1.2, length_tol_high: 3.4 }), recipe()).lengths
  assert.equal(asym.std, 213)
  assert.equal(asym.low, 213 - 1.2)
  assert.equal(asym.high, 213 + 3.4)
})

test('体积系数 k = (外径²−内径²)/4000×3.14,π 用 3.14 而不是 Math.PI', () => {
  assert.equal(compute(params({ od: 45, id: 30 }), recipe()).k, 0.883125)
  assert.equal(compute(params({ od: 59.5, id: 39.5 }), recipe()).k, 1.5543)
  // 用真 π 会得到 0.883567…,与 exe 的 0.883125 不同 —— 这条断言就是防止"顺手改成 Math.PI"
  assert.notEqual(compute(params({ od: 45, id: 30 }), recipe()).k, (Math.PI / 4) * (45 * 45 - 30 * 30) / 1000)
})

test('料位1 是补差位:最终比例[0] = 1 − Σ(料位2~10)', () => {
  const got = compute(params(), recipe({ powder: [0.62, 0, 0, 0, 0], glue: [0.33, 0.05], conv: [2, 1, 0.5] }))
  const rest = got.final_ratios.slice(1).reduce((a, b) => a + b, 0)
  assert.equal(got.final_ratios[0], 1 - rest)
  assert.equal(got.final_ratios[1], 0)
  assert.equal(got.final_ratios[5], got.glue_amounts[0] / got.total)
})

test('粉料含水率缺失按 0 计,并逐位告警(5 个粉料位 = 5 条)', () => {
  const r = compute(params(), recipe({ moist: null }))
  const missing = r.warnings.filter((w) => w.includes('水分未采集'))
  assert.equal(missing.length, 5)
  assert.equal(missing[0], '料位 1 水分未采集，按 0 计，请补充含水率')
  assert.equal(missing[4], '料位 5 水分未采集，按 0 计，请补充含水率')
  assert.equal(r.moisture.powder_avg, 0)
})

test('空配方(比例全 0)不产生 NaN/Infinity,比值全 0', () => {
  const got = compute(params(), [slot({ moisture: null }), ...Array.from({ length: 9 }, () => slot({ moisture: null }))])
  assert.equal(got.total, 0)
  assert.equal(got.moisture.mixed, 0)
  // 料位 1 兜底吃满 100%,其余全 0
  assert.equal(got.final_ratios[0], 1)
  assert.deepEqual(got.final_ratios.slice(1), new Array(9).fill(0))
  assertAllFinite(got)
})

/* ── 输入契约:与 Python 的失败方式不同,这里明确报错而不是静默算 NaN ── */

test('配方必须恰好 10 个料位,否则明确报错', () => {
  assert.throws(() => compute(params(), recipe().slice(0, 9)), /10 个料位/)
  assert.throws(() => compute(params(), [...recipe(), slot({})]), /10 个料位/)
})

test('必填参数缺失或非数字时明确报错(不静默算成 NaN)', () => {
  assert.throws(() => compute({ ...params(), od: null }, recipe()), /od/)
  assert.throws(() => compute({ ...params(), od: undefined }, recipe()), /od/)
  assert.throws(() => compute({ ...params(), length: 'abc' }, recipe()), /length/)
})

test('可选参数缺省:老键 length_tol 兜底、漂移系数默认 1.0', () => {
  const legacy = compute(
    { od: 45, id: 30, length: 200, cavities: 1, density_low: 1.2, density_high: 1.4, conversion_ratio: 0.5, length_tol: 2.5 },
    recipe())
  assert.deepEqual(legacy.lengths, { low: 210.5, std: 213, high: 215.5 })
  assert.equal(legacy.params.demold_low_factor, 1)
  assert.equal(legacy.params.demold_high_factor, 1)
  assert.equal(legacy.demold.low, legacy.dry_weights.low)
})
