import test from 'node:test'
import assert from 'node:assert/strict'
import { carbonSpecFrom } from './carbonSpec.js'

// 背景(2026-10-14 用户报障):
//   成型工艺清单「选产品编号 → 自动带出炭棒外径/内径/长度」一直没生效。
//   原因:回填只认产品信息表那一行的「炭棒尺寸」**整串**(实测该列全为空),
//   真源是三个独立列 炭棒外径/炭棒内径/炭棒长度(实测值 5/5/5)。
//   口径(用户原话「点击选择炭棒编号时应该自动带入对应的炭棒外径内径长度」):
//     · 三个独立字段**优先**;空的格不写(不许出现只有「外：」没有数字的半截值);
//     · 「炭棒尺寸」整串**只作逐格回退**(兼容只填了整串的老单);
//     · 两种来源的落格文本必须长得一样(前缀 外：/内：/长：)。

test('三个独立字段优先:裸数字落格带前缀,与整串分支同款', () => {
  const out = carbonSpecFrom({ 炭棒外径: '5', 炭棒内径: '5', 炭棒长度: '5', 炭棒尺寸: '' })
  assert.deepEqual(out, { 炭棒规格1: '外：5', 炭棒规格2: '内：5', 炭棒规格3: '长：5' })
})

test('独立字段有值时压过整串(整串不参与)', () => {
  const out = carbonSpecFrom({
    炭棒外径: '12.5', 炭棒内径: '5', 炭棒长度: '60',
    炭棒尺寸: '外径 9 mm，内径 9 mm，长度 9 mm',
  })
  assert.deepEqual(out, { 炭棒规格1: '外：12.5', 炭棒规格2: '内：5', 炭棒规格3: '长：60' })
})

test('独立字段为空 ⇒ 该格回退整串(逐格,不是整串一票否决)', () => {
  const out = carbonSpecFrom({
    炭棒外径: '', 炭棒内径: null, 炭棒长度: '60',
    炭棒尺寸: '外径 12 mm 内径 5 mm',
  })
  assert.deepEqual(out, { 炭棒规格1: '外：12', 炭棒规格2: '内：5', 炭棒规格3: '长：60' })
})

test('整串只填了一部分 ⇒ 只写抽得出来的那些格,不写半截值', () => {
  const out = carbonSpecFrom({ 炭棒尺寸: '外径 12 mm' })
  assert.deepEqual(out, { 炭棒规格1: '外：12' })
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
  assert.deepEqual(carbonSpecFrom({ 炭棒外径: ' 5 ' }), { 炭棒规格1: '外：5' })
})
