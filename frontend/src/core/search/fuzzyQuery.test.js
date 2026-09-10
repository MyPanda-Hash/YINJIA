import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_FIELDS, buildFuzzyQuery } from './fuzzyQuery.js'

test('empty rows produce an invalid empty query', () => {
  const q = buildFuzzyQuery([])
  assert.deepEqual(q.condition, {})
  assert.equal(q.keyword, '')
  assert.equal(q.valid, false)
})

test('rows without field or value are ignored', () => {
  const q = buildFuzzyQuery([
    { field: '', value: '上海' },
    { field: '客户名', value: '' },
    { field: '客户名', value: '   ' },
    { field: null, value: null },
  ])
  assert.deepEqual(q.condition, {})
  assert.equal(q.valid, false)
})

test('a field condition becomes a like-matching condition entry', () => {
  const q = buildFuzzyQuery([{ field: '客户名', value: '  上海启明  ' }])
  assert.deepEqual(q.condition, { 客户名: '上海启明' })
  assert.equal(q.keyword, '')
  assert.equal(q.valid, true)
})

test('the all-fields option becomes the keyword instead of a condition', () => {
  const q = buildFuzzyQuery([{ field: ALL_FIELDS, value: '跌落' }])
  assert.deepEqual(q.condition, {})
  assert.equal(q.keyword, '跌落')
  assert.equal(q.valid, true)
})

test('several field conditions combine (anded by the backend)', () => {
  const q = buildFuzzyQuery([
    { field: '客户名', value: '上海' },
    { field: '密级', value: '内部' },
  ])
  assert.deepEqual(q.condition, { 客户名: '上海', 密级: '内部' })
  assert.equal(q.valid, true)
})

test('field conditions and the all-fields keyword combine', () => {
  const q = buildFuzzyQuery([
    { field: '密级', value: '保密' },
    { field: ALL_FIELDS, value: '装箱' },
  ])
  assert.deepEqual(q.condition, { 密级: '保密' })
  assert.equal(q.keyword, '装箱')
  assert.equal(q.valid, true)
})

test('a later row wins for the same field', () => {
  const q = buildFuzzyQuery([
    { field: '客户名', value: '上海' },
    { field: '客户名', value: '南京' },
  ])
  assert.deepEqual(q.condition, { 客户名: '南京' })
})

test('a later all-fields row wins for the keyword', () => {
  const q = buildFuzzyQuery([
    { field: ALL_FIELDS, value: '甲' },
    { field: ALL_FIELDS, value: '乙' },
  ])
  assert.equal(q.keyword, '乙')
})

test('detail fields are treated like any other field key', () => {
  const q = buildFuzzyQuery([{ field: '测试方法', value: 'GB/T' }])
  assert.deepEqual(q.condition, { 测试方法: 'GB/T' })
})
