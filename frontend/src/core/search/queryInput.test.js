import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FUZZY_KEY,
  MAX_CODE_LIST,
  applyCodes,
  applyFuzzy,
  applyPicked,
  clearField,
  normalizeCodeList,
  parseFuzzy,
} from './queryInput.js'

// ---------------------------------------------------------------- parseFuzzy

test('parseFuzzy: no control key means no fuzzy fields', () => {
  assert.deepEqual(parseFuzzy({}), [])
  assert.deepEqual(parseFuzzy({ 产品编码: 'YJ-LL-003' }), [])
  assert.deepEqual(parseFuzzy(null), [])
  assert.deepEqual(parseFuzzy(undefined), [])
})

test('parseFuzzy: empty control key means no fuzzy fields', () => {
  assert.deepEqual(parseFuzzy({ [FUZZY_KEY]: '' }), [])
  assert.deepEqual(parseFuzzy({ [FUZZY_KEY]: ' , , ' }), [])
})

test('parseFuzzy: splits the comma separated label list and trims each label', () => {
  assert.deepEqual(parseFuzzy({ [FUZZY_KEY]: '产品编码, 客户编码' }), ['产品编码', '客户编码'])
})

test('parseFuzzy: keeps the original order and drops duplicates/empties', () => {
  assert.deepEqual(parseFuzzy({ [FUZZY_KEY]: '产品编码,,客户编码,产品编码,' }), ['产品编码', '客户编码'])
})

test('parseFuzzy: also accepts an array (robust against hand-written conditions)', () => {
  assert.deepEqual(parseFuzzy({ [FUZZY_KEY]: ['产品编码', ' 客户编码 ', null] }), ['产品编码', '客户编码'])
})

// ---------------------------------------------------------------- applyFuzzy

test('applyFuzzy: writes the typed fragment and marks the field label', () => {
  const condition = {}
  applyFuzzy(condition, '产品编码', '  YJ-LL  ')
  assert.deepEqual(condition, { 产品编码: 'YJ-LL', [FUZZY_KEY]: '产品编码' })
})

test('applyFuzzy: a second field is appended without dropping the first', () => {
  const condition = {}
  applyFuzzy(condition, '产品编码', 'YJ')
  applyFuzzy(condition, '客户编码', 'K0012')
  assert.deepEqual(condition, { 产品编码: 'YJ', 客户编码: 'K0012', [FUZZY_KEY]: '产品编码,客户编码' })
})

test('applyFuzzy: typing again for the same field does not duplicate its label', () => {
  const condition = {}
  applyFuzzy(condition, '产品编码', 'Y')
  applyFuzzy(condition, '产品编码', 'YJ-LL')
  assert.deepEqual(condition, { 产品编码: 'YJ-LL', [FUZZY_KEY]: '产品编码' })
})

test('applyFuzzy: an exact pick of the same field first, then free typing, re-marks it', () => {
  const condition = {}
  applyPicked(condition, '产品编码', 'YJ-LL-003')
  applyFuzzy(condition, '产品编码', 'YJ-LL')
  assert.deepEqual(condition, { 产品编码: 'YJ-LL', [FUZZY_KEY]: '产品编码' })
})

test('applyFuzzy: an empty fragment clears the field like clearField', () => {
  const condition = { 产品编码: 'YJ', [FUZZY_KEY]: '产品编码' }
  applyFuzzy(condition, '产品编码', '   ')
  assert.deepEqual(condition, {})

  const undefinedText = { 产品编码: 'YJ', [FUZZY_KEY]: '产品编码' }
  applyFuzzy(undefinedText, '产品编码', undefined)
  assert.deepEqual(undefinedText, {})
})

test('applyFuzzy: other field conditions/marks are left untouched', () => {
  const condition = { 客户编码: 'K0012', [FUZZY_KEY]: '客户编码' }
  applyFuzzy(condition, '产品编码', 'YJ')
  assert.deepEqual(condition, { 客户编码: 'K0012', 产品编码: 'YJ', [FUZZY_KEY]: '客户编码,产品编码' })
})

// ---------------------------------------------------------------- applyPicked

test('applyPicked: writes the picked code and unmarks the field', () => {
  const condition = {}
  applyFuzzy(condition, '产品编码', 'YJ')
  applyPicked(condition, '产品编码', 'YJ-LL-003')
  assert.deepEqual(condition, { 产品编码: 'YJ-LL-003' })
})

test('applyPicked: only the picked field loses its mark', () => {
  const condition = {}
  applyFuzzy(condition, '产品编码', 'YJ')
  applyFuzzy(condition, '客户编码', 'K0')
  applyPicked(condition, '产品编码', 'YJ-LL-003')
  assert.deepEqual(condition, { 产品编码: 'YJ-LL-003', 客户编码: 'K0', [FUZZY_KEY]: '客户编码' })
})

test('applyPicked: keeps the code exactly as given (SQL Server char columns keep trailing spaces)', () => {
  const condition = {}
  applyPicked(condition, '仓库', 'A1 ')
  assert.equal(condition['仓库'], 'A1 ')
})

test('applyPicked: an empty code deletes the value and still unmarks the field', () => {
  const condition = { 产品编码: 'YJ', [FUZZY_KEY]: '产品编码' }
  applyPicked(condition, '产品编码', '')
  assert.deepEqual(condition, {})
})

test('applyPicked: picking an unmarked field leaves the mark list alone', () => {
  const condition = { [FUZZY_KEY]: '客户编码' }
  applyPicked(condition, '产品编码', 'YJ-LL-003')
  assert.deepEqual(condition, { [FUZZY_KEY]: '客户编码', 产品编码: 'YJ-LL-003' })
})

// ---------------------------------------------------------------- normalizeCodeList

test('normalizeCodeList: trims, drops empties and de-duplicates, keeping the first order', () => {
  assert.deepEqual(normalizeCodeList([' YJ-LL-003 ', '', null, 'YJ-LL-003', 'KH-0012', '  ']), [
    'YJ-LL-003',
    'KH-0012',
  ])
})

test('normalizeCodeList: a single value (not an array) is accepted as a one-item list', () => {
  assert.deepEqual(normalizeCodeList('YJ-LL-003'), ['YJ-LL-003'])
  assert.deepEqual(normalizeCodeList(1001), ['1001'])
})

test('normalizeCodeList: null / undefined / empty arrays become an empty list', () => {
  assert.deepEqual(normalizeCodeList(null), [])
  assert.deepEqual(normalizeCodeList(undefined), [])
  assert.deepEqual(normalizeCodeList([]), [])
})

test('normalizeCodeList: caps the list (200 by default, custom limit honored)', () => {
  const many = Array.from({ length: 250 }, (_, i) => `C${String(i).padStart(3, '0')}`)
  assert.equal(normalizeCodeList(many).length, MAX_CODE_LIST)
  assert.equal(normalizeCodeList(many)[MAX_CODE_LIST - 1], 'C199')
  assert.deepEqual(normalizeCodeList(many, 3), ['C000', 'C001', 'C002'])
})

test('normalizeCodeList: the cap counts unique codes, not raw items', () => {
  assert.deepEqual(normalizeCodeList(['A', 'A', 'B', 'B', 'C'], 2), ['A', 'B'])
})

// ---------------------------------------------------------------- applyCodes

test('applyCodes: writes the code array and unmarks the field', () => {
  const condition = {}
  applyFuzzy(condition, '产品编码', '钢管')
  applyCodes(condition, '产品编码', ['YJ-LL-001', 'YJ-LL-002'])
  assert.deepEqual(condition, { 产品编码: ['YJ-LL-001', 'YJ-LL-002'] })
})

test('applyCodes: normalizes the incoming codes (trim/dedupe/cap)', () => {
  const condition = {}
  applyCodes(condition, '产品编码', [' YJ-LL-001 ', 'YJ-LL-001', '', 'YJ-LL-002'], 2)
  assert.deepEqual(condition, { 产品编码: ['YJ-LL-001', 'YJ-LL-002'] })
})

test('applyCodes: other fields keep their values and their fuzzy marks', () => {
  const condition = {}
  applyFuzzy(condition, '客户编码', 'K0')
  applyCodes(condition, '产品编码', ['YJ-LL-001'])
  assert.deepEqual(condition, { 客户编码: 'K0', 产品编码: ['YJ-LL-001'], [FUZZY_KEY]: '客户编码' })
})

test('applyCodes: an empty code set clears the field instead of writing an empty array', () => {
  const condition = { 产品编码: 'YJ', [FUZZY_KEY]: '产品编码' }
  applyCodes(condition, '产品编码', [])
  assert.deepEqual(condition, {})
  applyCodes(condition, '产品编码', ['  ', null])
  assert.deepEqual(condition, {})
})

test('applyCodes: replaces a previously typed fragment value (no stale text left)', () => {
  const condition = {}
  applyFuzzy(condition, '产品编码', '钢管')
  applyCodes(condition, '产品编码', ['YJ-LL-001'])
  assert.equal(condition['产品编码'][0], 'YJ-LL-001')
  assert.equal(FUZZY_KEY in condition, false)
})

// ---------------------------------------------------------------- clearField

test('clearField: deletes the condition value and the mark', () => {
  const condition = {}
  applyFuzzy(condition, '产品编码', 'YJ')
  clearField(condition, '产品编码')
  assert.deepEqual(condition, {})
})

test('clearField: the control key disappears once the last mark is removed', () => {
  const condition = { [FUZZY_KEY]: '产品编码' }
  clearField(condition, '产品编码')
  assert.equal(FUZZY_KEY in condition, false)
})

test('clearField: other fields keep both their values and their marks', () => {
  const condition = {}
  applyFuzzy(condition, '产品编码', 'YJ')
  applyFuzzy(condition, '客户编码', 'K0')
  clearField(condition, '产品编码')
  assert.deepEqual(condition, { 客户编码: 'K0', [FUZZY_KEY]: '客户编码' })
})

test('clearField: clearing a field that was never set is a no-op', () => {
  const condition = { 客户编码: 'K0' }
  clearField(condition, '产品编码')
  assert.deepEqual(condition, { 客户编码: 'K0' })
})

test('clearField: an exact (equal-matching) value is removed too, not just fuzzy ones', () => {
  const condition = { 产品编码: 'YJ-LL-003' }
  clearField(condition, '产品编码')
  assert.deepEqual(condition, {})
})

// ---------------------------------------------------------------- 往返组合

test('the typical flow: fuzzy typing -> pick -> clear produces equal-matching then empty conditions', () => {
  const condition = {}
  applyFuzzy(condition, '产品编码', 'YJ-LL')
  assert.equal(condition[FUZZY_KEY], '产品编码') // 手打片段 ⇒ 后端 LIKE
  applyPicked(condition, '产品编码', 'YJ-LL-003')
  assert.equal(FUZZY_KEY in condition, false) // 精确选中 ⇒ 后端等值
  clearField(condition, '产品编码')
  assert.deepEqual(condition, {})
})
