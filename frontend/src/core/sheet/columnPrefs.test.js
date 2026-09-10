import test from 'node:test'
import assert from 'node:assert/strict'
import { buildColumnPrefsPayload, isColumnHidden, resolveColumnLabel } from './columnPrefs.js'

test('a saved alias wins over the default label', () => {
  assert.equal(resolveColumnLabel({ displayName: '冲洗时间' }, '冲水时间'), '冲洗时间')
})

test('without an alias the default label is kept', () => {
  assert.equal(resolveColumnLabel({}, '冲水时间'), '冲水时间')
  assert.equal(resolveColumnLabel({ displayName: '' }, '冲水时间'), '冲水时间')
  assert.equal(resolveColumnLabel(null, '冲水时间'), '冲水时间')
})

test('a column is hidden only when visible is explicitly false', () => {
  assert.equal(isColumnHidden({ visible: false }), true)
  assert.equal(isColumnHidden({ visible: true }), false)
  assert.equal(isColumnHidden({}), false)
  assert.equal(isColumnHidden(null), false)
})

test('only changed rows are sent (alias renamed)', () => {
  const rows = [
    { key: '冲水时间', alias: '冲洗时间', originalAlias: '', visible: true, originalVisible: true },
    { key: '测试时间', alias: '', originalAlias: '', visible: true, originalVisible: true },
  ]
  assert.deepEqual(buildColumnPrefsPayload(rows), [{ label: '冲水时间', alias: '冲洗时间', visible: true }])
})

test('only changed rows are sent (column hidden)', () => {
  const rows = [
    { key: '冲水时间', alias: '', originalAlias: '', visible: false, originalVisible: true },
    { key: '测试时间', alias: '', originalAlias: '', visible: true, originalVisible: true },
  ]
  assert.deepEqual(buildColumnPrefsPayload(rows), [{ label: '冲水时间', alias: '', visible: false }])
})

test('clearing an alias is sent as an empty string', () => {
  const rows = [{ key: '水温（℃）', alias: '', originalAlias: '炉温', visible: true, originalVisible: true }]
  assert.deepEqual(buildColumnPrefsPayload(rows), [{ label: '水温（℃）', alias: '', visible: true }])
})

test('no changes produce an empty payload', () => {
  const rows = [
    { key: '冲水时间', alias: '冲洗时间', originalAlias: '冲洗时间', visible: true, originalVisible: true },
    { key: '测试时间', alias: '', originalAlias: '', visible: true, originalVisible: true },
  ]
  assert.deepEqual(buildColumnPrefsPayload(rows), [])
})

test('an alias change and a hide on the same row are sent once', () => {
  const rows = [{ key: '累计进水（L）', alias: '进水', originalAlias: '', visible: false, originalVisible: true }]
  assert.deepEqual(buildColumnPrefsPayload(rows), [{ label: '累计进水（L）', alias: '进水', visible: false }])
})
