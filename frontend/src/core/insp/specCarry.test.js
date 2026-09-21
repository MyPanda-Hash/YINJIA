import test from 'node:test'
import assert from 'node:assert/strict'
import { specCarryFailure, specDrift } from './specCarry.js'

/**
 * 「自动填充规格书」的失败口径(2026-09-21 用户口径):
 *   出货检验计划表选产品编号时按规格书自动带入检验方法,**但必须规格书已经填写并提交审批完**。
 *   后端 /px/specByProduct 在规格书没审批完时返回 { found:false, reason:'not_approved', 规格书编号, 规格书状态 },
 *   界面据此说清"是哪一张、什么状态",而不是一句含糊的"没有规格书"。
 */

test('规格书可用(found=true) ⇒ 没有失败口径', () => {
  assert.equal(specCarryFailure({ found: true, 单据编号: 'SD-1' }), null)
})

test('规格书未审批完 ⇒ not_approved,并带上是哪一张、什么状态', () => {
  assert.deepEqual(
    specCarryFailure({ found: false, reason: 'not_approved', 规格书编号: 'SD-2026-09-0042', 规格书状态: '草稿' }),
    { kind: 'not_approved', specNo: 'SD-2026-09-0042', status: '草稿' },
  )
})

test('审批中的规格书同样算未审批完(状态原样带出)', () => {
  const r = specCarryFailure({ found: false, reason: 'not_approved', 规格书编号: 'SD-2', 规格书状态: '审批中' })
  assert.equal(r.kind, 'not_approved')
  assert.equal(r.status, '审批中')
})

test('压根没有规格书(没有 reason / 空 payload / null)⇒ no_spec', () => {
  assert.equal(specCarryFailure({ found: false }).kind, 'no_spec')
  assert.equal(specCarryFailure({}).kind, 'no_spec')
  assert.equal(specCarryFailure(null).kind, 'no_spec')
})

test('not_approved 但编号/状态缺失也不炸(给空串)', () => {
  assert.deepEqual(specCarryFailure({ found: false, reason: 'not_approved' }), { kind: 'not_approved', specNo: '', status: '' })
})

/* ── specDrift:出货检验当前内容 vs 规格书(「规格书变动就提示」的判据)──────────────
   用户口径(2026-09-21):「出货检验根据规格书进行录入,检验项根据规格书一致,能自动填入,
   规格书变动就提示当前出货检验进行提示。」
   即:单子填完之后规格书又变了 ⇒ 单子上要看得见"与规格书不一致",并能一键按规格书更新。 */

const SPEC = [
  { 检验项目: '外观', 检验要求: '无黑点、无杂质', 检验方法: '目视检查' },
  { 检验项目: '压降', 检验要求: '≤5 kPa', 检验方法: '压降试验台' },
  { 检验项目: '抗压强度', 检验要求: '≥12 kgf', 检验方法: '万能试验机' },
]
const plan = (rows) => rows.map((r) => ({ 控制项目: r.检验项目, 控制标准及要求: r.检验要求, 控制方法: r.检验方法 }))

test('完全一致 ⇒ 没有变动', () => {
  const d = specDrift(SPEC, plan(SPEC))
  assert.deepEqual(d, { added: [], removed: [], changed: [], drifted: false })
})

test('规格书新增一项 ⇒ added', () => {
  const d = specDrift([...SPEC, { 检验项目: '铅含量', 检验要求: '≤0.01 mg/L', 检验方法: 'ICP-MS' }], plan(SPEC))
  assert.deepEqual(d.added, ['铅含量'])
  assert.equal(d.drifted, true)
})

test('规格书删掉一项 ⇒ removed', () => {
  const d = specDrift(SPEC.slice(0, 2), plan(SPEC))
  assert.deepEqual(d.removed, ['抗压强度'])
  assert.equal(d.drifted, true)
})

test('同名项但要求或方法变了 ⇒ changed(报出是哪一项、哪几列变了)', () => {
  const spec2 = [{ 检验项目: '压降', 检验要求: '≤6 kPa', 检验方法: '压降试验台(新版)' }]
  const d = specDrift(spec2, plan([SPEC[1]]))
  assert.deepEqual(d.changed, [{ item: '压降', fields: ['检验要求', '检验方法'] }])
  assert.equal(d.drifted, true)
})

test('顺序不同不算变动(按项目名对齐)', () => {
  const d = specDrift([SPEC[1], SPEC[0], SPEC[2]], plan(SPEC))
  assert.equal(d.drifted, false)
})

test('空白/换行差异不算变动(比对前归一空格)', () => {
  const d = specDrift([{ 检验项目: ' 外观 ', 检验要求: '无黑点、\n无杂质 ', 检验方法: '目视 检查' }],
    plan([{ 检验项目: '外观', 检验要求: '无黑点、无杂质', 检验方法: '目视检查' }]))
  assert.equal(d.drifted, false)
})

test('本单里没有项目名的空行(模板提示行)不参与比对', () => {
  const d = specDrift(SPEC, [...plan(SPEC), { 控制项目: '', 控制标准及要求: '', 控制方法: '' }])
  assert.equal(d.drifted, false)
})

test('规格书一行都没有(或本单空)⇒ 不报变动(交给"没有可带入"那条路径)', () => {
  assert.equal(specDrift([], plan(SPEC)).drifted, false)
  assert.equal(specDrift(SPEC, []).drifted, false)
  assert.equal(specDrift(null, null).drifted, false)
})
