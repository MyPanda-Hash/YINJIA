import test from 'node:test'
import assert from 'node:assert/strict'
import { carbonSpecFrom } from './carbonSpec.js'

// 背景(2026-10-14 用户报障):
//   成型工艺清单「选产品编号 → 自动带出炭棒外径/内径/长度」一直没生效。
//   原因:回填只认产品信息表那一行的「炭棒尺寸」**整串**(实测该列全为空),
//   真源是三个独立列 炭棒外径/炭棒内径/炭棒长度(实测值 5/5/5)。
//   口径(用户原话「点击选择炭棒编号时应该自动带入对应的炭棒外径内径长度」):
//     · 三个独立字段**优先**;空的格不写(不许出现只有「外：」没有数字的半截值);
//     · 「炭棒尺寸」整串**只作逐格回退**(兼容只填了整串的老单)。
//
// ⚠ 2026-11-03 改口径(用户报障「烧结工艺清单导进来的炭棒规格带文字,导致后续计算有问题,
//   还得手动删掉」):落格文本**只写裸数字**,`外：`/`内：`/`长：` 改由纸面按配置渲染
//   (recordSheetConfigs 的 `pre`)。
//   为什么:前缀写进数据后,凡是按数字消费的地方都得额外兼容 —— parseSpecNumber 兼容了,
//   但 matchSinterModel(烧结型号自动选)与 sinterLengthWarning(长度越界提示)没走它,
//   `Number('外：56.5')` = NaN ⇒ **静默失效**;界面上还只能看到脏文本、用户只能手删。
//   数据键存的是"值",显示标签是"表现" —— 两者混在一起就是这次事故。

test('三个独立字段优先:落格是**裸数字**,不带 外：/内：/长： 前缀', () => {
  const out = carbonSpecFrom({ 炭棒外径: '5', 炭棒内径: '5', 炭棒长度: '5', 炭棒尺寸: '' })
  assert.deepEqual(out, { 炭棒规格1: '5', 炭棒规格2: '5', 炭棒规格3: '5' })
})

test('独立字段有值时压过整串(整串不参与)', () => {
  const out = carbonSpecFrom({
    炭棒外径: '12.5', 炭棒内径: '5', 炭棒长度: '60',
    炭棒尺寸: '外径 9 mm，内径 9 mm，长度 9 mm',
  })
  assert.deepEqual(out, { 炭棒规格1: '12.5', 炭棒规格2: '5', 炭棒规格3: '60' })
})

test('独立字段为空 ⇒ 该格回退整串(逐格,不是整串一票否决)', () => {
  const out = carbonSpecFrom({
    炭棒外径: '', 炭棒内径: null, 炭棒长度: '60',
    炭棒尺寸: '外径 12 mm 内径 5 mm',
  })
  assert.deepEqual(out, { 炭棒规格1: '12', 炭棒规格2: '5', 炭棒规格3: '60' })
})

test('整串只填了一部分 ⇒ 只写抽得出来的那些格,不写半截值', () => {
  const out = carbonSpecFrom({ 炭棒尺寸: '外径 12 mm' })
  assert.deepEqual(out, { 炭棒规格1: '12' })
})

test('两个来源都没有值 ⇒ 一个格都不写(不覆盖纸上手填的值)', () => {
  assert.deepEqual(carbonSpecFrom({ 炭棒尺寸: '', 炭棒外径: '', 炭棒内径: '  ', 炭棒长度: null }), {})
  assert.deepEqual(carbonSpecFrom({}), {})
})

test('没有这三个格的成型面板(enabled=false)⇒ 一律不写', () => {
  const src = { 炭棒外径: '5', 炭棒内径: '5', 炭棒长度: '5', 炭棒尺寸: '外径 9 mm' }
  assert.deepEqual(carbonSpecFrom(src, false), {})
})

test('source 为 null/undefined 不炸', () => {
  assert.deepEqual(carbonSpecFrom(null), {})
  assert.deepEqual(carbonSpecFrom(undefined), {})
})

test('独立字段整串写法(「5 mm」/带空格)按原样 trim 落格', () => {
  assert.deepEqual(carbonSpecFrom({ 炭棒外径: ' 5 ' }), { 炭棒规格1: '5' })
})

/* ── 落格文本必须是"能被 Number() 直接吃下的裸数字"(2026-11-03 根因钉子) ── */

test('落格值一律 Number() 可解析 —— 这是本次事故的判据,不许再混入任何文字', () => {
  const cases = [
    { 炭棒外径: '6', 炭棒内径: '33', 炭棒长度: '39' },
    { 炭棒尺寸: '外径 12 mm 内径 5 mm 长度 60 mm' },
    { 炭棒外径: ' 88.5 ', 炭棒内径: '69', 炭棒长度: '159' },
  ]
  for (const src of cases) {
    const out = carbonSpecFrom(src)
    for (const [k, v] of Object.entries(out)) {
      assert.ok(Number.isFinite(Number(v)), `${k}=${JSON.stringify(v)} 不是裸数字(Number() 得 NaN)`)
      // 明确禁止冒号前缀(全角/半角都不行)
      assert.ok(!/[：:]/.test(v), `${k}=${JSON.stringify(v)} 仍带冒号前缀`)
    }
  }
})
