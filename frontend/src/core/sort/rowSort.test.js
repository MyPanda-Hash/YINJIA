import test from 'node:test'
import assert from 'node:assert/strict'
import { nextSortState, sortRows } from './rowSort.js'

const NUM = { dataType: '小数' }
const INT = { dataType: '整数' }
const TXT = { dataType: '文本' }
const DATE = { dataType: '日期' }
const DATETIME = { dataType: '日期时间' }

test('numeric field sorts by value ascending and descending', () => {
  const rows = [{ 金额: 20 }, { 金额: 3 }, { 金额: 11 }]
  assert.deepEqual(sortRows(rows, { prop: '金额', order: 'asc', field: NUM }).map((r) => r.金额), [3, 11, 20])
  assert.deepEqual(sortRows(rows, { prop: '金额', order: 'desc', field: NUM }).map((r) => r.金额), [20, 11, 3])
})

test('integer field sorts by value', () => {
  const rows = [{ 数量: '10' }, { 数量: '9' }, { 数量: '100' }]
  assert.deepEqual(sortRows(rows, { prop: '数量', order: 'asc', field: INT }).map((r) => r.数量), ['9', '10', '100'])
})

test('number strings with separators sort by value', () => {
  const rows = [{ 金额: '1,200.50' }, { 金额: '999' }, { 金额: '80%' }]
  assert.deepEqual(sortRows(rows, { prop: '金额', order: 'asc', field: NUM }).map((r) => r.金额), ['80%', '999', '1,200.50'])
})

test('chinese text field sorts by pinyin', () => {
  const rows = [{ 客户: '张三' }, { 客户: '李四' }, { 客户: '王五' }]
  assert.deepEqual(sortRows(rows, { prop: '客户', order: 'asc', field: TXT }).map((r) => r.客户), ['李四', '王五', '张三'])
})

test('text column keeps one collation even when values look numeric', () => {
  const rows = [{ 编号: '10' }, { 编号: '9' }, { 编号: '100' }]
  assert.deepEqual(sortRows(rows, { prop: '编号', order: 'asc', field: TXT }).map((r) => r.编号), ['10', '100', '9'])
})

test('date field sorts by time across formats', () => {
  const rows = [{ 日期: '2026/9/10' }, { 日期: '2026-09-02' }, { 日期: '2026-09-09' }]
  assert.deepEqual(sortRows(rows, { prop: '日期', order: 'asc', field: DATE }).map((r) => r.日期), ['2026-09-02', '2026-09-09', '2026/9/10'])
})

test('datetime field sorts by time including seconds and ISO form', () => {
  const rows = [{ 时间: '2026-09-09T08:30:00' }, { 时间: '2026-09-09 10:00' }, { 时间: '2026-09-09 09:15:30' }]
  assert.deepEqual(
    sortRows(rows, { prop: '时间', order: 'asc', field: DATETIME }).map((r) => r.时间),
    ['2026-09-09T08:30:00', '2026-09-09 09:15:30', '2026-09-09 10:00']
  )
})

test('blank values stay last in both directions', () => {
  const rows = [{ v: 'b' }, { v: '' }, { v: 'a' }, { v: null }, { v: undefined }]
  assert.deepEqual(sortRows(rows, { prop: 'v', order: 'asc', field: TXT }).map((r) => r.v), ['a', 'b', '', null, undefined])
  assert.deepEqual(sortRows(rows, { prop: 'v', order: 'desc', field: TXT }).map((r) => r.v), ['b', 'a', '', null, undefined])
})

test('numbers keep blanks last as well', () => {
  const rows = [{ n: 5 }, { n: null }, { n: 1 }]
  assert.deepEqual(sortRows(rows, { prop: 'n', order: 'asc', field: NUM }).map((r) => r.n), [1, 5, null])
})

test('sorting is stable and does not mutate the input array', () => {
  const rows = [{ v: 'a', id: 1 }, { v: 'a', id: 2 }, { v: 'a', id: 3 }]
  const sorted = sortRows(rows, { prop: 'v', order: 'asc', field: TXT })
  assert.deepEqual(sorted.map((r) => r.id), [1, 2, 3])
  assert.deepEqual(rows.map((r) => r.id), [1, 2, 3])
  assert.notEqual(sorted, rows)
})

test('no order returns a copy in original order', () => {
  const rows = [{ v: 2 }, { v: 1 }]
  const sorted = sortRows(rows, { prop: 'v', order: '', field: NUM })
  assert.deepEqual(sorted.map((r) => r.v), [2, 1])
  assert.notEqual(sorted, rows)
})

test('rows without placeholder flag are sorted together', () => {
  const rows = [{ v: 3 }, { v: 1 }, { v: 2 }]
  assert.deepEqual(sortRows(rows, { prop: 'v', order: 'asc', field: NUM }).map((r) => r.v), [1, 2, 3])
})

test('missing field metadata keeps legacy detection (numeric when both sides are numeric)', () => {
  const rows = [{ 金额: 20 }, { 金额: 3 }, { 金额: 11 }]
  assert.deepEqual(sortRows(rows, { prop: '金额', order: 'asc' }).map((r) => r.金额), [3, 11, 20])
  const texts = [{ 客户: '张三' }, { 客户: '李四' }]
  assert.deepEqual(sortRows(texts, { prop: '客户', order: 'asc' }).map((r) => r.客户), ['李四', '张三'])
})

test('header click on a fresh column sorts ascending', () => {
  assert.deepEqual(nextSortState({ prop: '', order: '' }, '数量'), { prop: '数量', order: 'asc' })
})

test('second header click flips to descending', () => {
  assert.deepEqual(nextSortState({ prop: '数量', order: 'asc' }, '数量'), { prop: '数量', order: 'desc' })
})

test('third header click clears the sort', () => {
  assert.deepEqual(nextSortState({ prop: '数量', order: 'desc' }, '数量'), { prop: '', order: '' })
})

test('clicking another column replaces the previous sort', () => {
  assert.deepEqual(nextSortState({ prop: '数量', order: 'desc' }, '金额'), { prop: '金额', order: 'asc' })
})
