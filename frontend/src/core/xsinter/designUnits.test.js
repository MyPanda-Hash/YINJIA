/**
 * designUnits.test.js —— 「设计添加量」单位换算的验收基准  2026-10-30
 *
 * 用户报障原文：「新的面板的配方计算器没有默认百分比%，填数字会超过1，计算异常」
 * 截图里的具体数：粉料2 填 10、胶粉1 填 45 ⇒ 引擎收到 10 与 45（当 1000% / 4500%），
 * 比例合计 55、粉料1 倒推 −54、单支含量 −6302.99g。
 *
 * 所以下面每条都钉死"人手怎么填、引擎拿到多少"：
 *   10 / '10%' / 0.1 → 0.1            （粉料/胶粉，三种写法同一个意思）
 *   2                → 2 克，**不是 0.02**（颗粒料）
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { engineDesignsOf, gramsOfDesign, isGramRow, percentOf, ratioOfDesign } from './designUnits.js'
import { computeXsinter, problemsOf, ROW_KINDS } from './calcEngine.js'

/** 按料位顺序把「人敲在格子里的文本」拼成弹窗那份行 */
const linesOf = (designs) => ROW_KINDS.map((kind, i) => ({ kind, design: String(designs[i] ?? '') }))

/* ── ① 粉料/胶粉：百分数与小数都要解释对 ── */
test('① 比例行：10 / "10%" / 0.1 都等于 10%（用户报障的那一格）', () => {
  assert.equal(ratioOfDesign('10'), 0.1, '裸数字 10 必须当 10%，不能当 1000%')
  assert.equal(ratioOfDesign('10%'), 0.1)
  assert.equal(ratioOfDesign('0.1'), 0.1, '小于 1 的小数原样当比例')
  assert.equal(ratioOfDesign('45'), 0.45)
  assert.equal(ratioOfDesign('1'), 1, '1 = 100%，不是 1%')
})

test('② 比例行：空值/脏值 → 0（不抛错、不出 NaN）', () => {
  for (const bad of ['', ' ', null, undefined, 'abc', '%']) assert.equal(ratioOfDesign(bad), 0, `输入 ${bad}`)
})

/* ── ② 颗粒料：克数，绝不能被当百分数 ── */
test('③ 颗粒料行：填 2 就是 2 克，不能变成 2%', () => {
  assert.equal(isGramRow('颗粒料1'), true)
  assert.equal(isGramRow('粉料1'), false)
  assert.equal(isGramRow('胶粉1'), false)
  assert.equal(gramsOfDesign('2'), 2)
  assert.equal(gramsOfDesign('2.5'), 2.5)
  assert.equal(gramsOfDesign(''), 0)
})

/* ── ③ 整表映射：两种单位混在一起也对 ── */
test('④ engineDesignsOf：粉料/胶粉转比例，颗粒料留克数', () => {
  const lines = linesOf([0, '26.5', '2%', 0, 0, '45', 0, '1.5', '2.5', 0])
  assert.deepEqual(engineDesignsOf(lines), [0, 0.265, 0.02, 0, 0, 0.45, 0, 1.5, 2.5, 0])
  assert.deepEqual(engineDesignsOf(null), [], '不传行也不抛错')
})

/* ── ④ 端到端：T205 那组输入改成"人手填百分数"的写法，结果必须一模一样 ── */
test('⑤ T205 按百分数录入（26.5 / 2 / 45）与按小数录入算出同一张表', () => {
  const head = {
    rodOuter: '30', rodInner: '12', shipLength: '116',
    granuleFactor: '0.65', lengthFix: '0.5', densLow: '0.55', densHigh: '0.64',
  }
  const designs = engineDesignsOf(linesOf([0, '26.5', '2', 0, 0, '45', 0, 0, 0, 0]))
  const r = computeXsinter({ ...head, designs })
  // 引擎输出统一 r6，故与 calcEngine.test.js 一样按容差比（不要求 8 位小数）
  const near = (a, b, tol = 1e-5) => Math.abs(a - b) <= tol
  assert.ok(near(r.volume, 69.13809), `体积 ${r.volume}`)
  assert.ok(near(r.totalWeight, 41.13716355), `单支总重 ${r.totalWeight}`)
  assert.equal(r.totalRatio, 1)
  assert.equal(r.rows[0].design, 0.265, '粉料1 仍由 1 − Σ其他 倒推')
  assert.deepEqual(problemsOf({ ...head, designs }), [], '按百分数填完不应再报"超过 1"')
})

/* ── ⑤ 显示换算 ── */
test('⑥ percentOf：比例 → 百分数（0.265 → 26.5，无浮点尾巴）', () => {
  assert.equal(percentOf(0.265), 26.5)
  assert.equal(percentOf(0.45), 45)
  assert.equal(percentOf(1), 100)
  assert.equal(percentOf(-0.54), -54)
  assert.equal(percentOf(null), 0)
})
