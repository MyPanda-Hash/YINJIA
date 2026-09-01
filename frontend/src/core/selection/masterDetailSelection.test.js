import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allDetailsSelected,
  collectDocumentSelections,
  groupMasterDetailRows,
  mapSalesOrderLineToProduction,
  setDocumentSelection,
  sourceWithSelectedDetails,
  someDetailsSelected,
  toggleMasterDetails,
} from './masterDetailSelection.js'

const rows = [
  { 来源单号: 'SO-001', 产品编码: 'CP001', 产品名称: '产品一', 数量: 2, 计量单位: '件', 预计交货日期: '2026-09-01' },
  { 来源单号: 'SO-001', 产品编码: 'CP002', 产品名称: '产品二', 数量: 3, 计量单位: '件' },
  { 来源单号: 'SO-002', 产品编码: 'CP003', 产品名称: '产品三', 数量: 4, 计量单位: '件' },
]

test('groups flat source rows into non-selectable master records with corresponding details', () => {
  const masters = groupMasterDetailRows(rows)
  assert.equal(masters.length, 2)
  assert.equal(masters[0]._documentNo, 'SO-001')
  assert.deepEqual(masters[0].details.map((row) => row.产品编码), ['CP001', 'CP002'])
  assert.deepEqual(masters[1].details.map((row) => row.产品编码), ['CP003'])
  assert.ok(masters.every((master) => master.details.every((detail) => detail._documentNo === master._documentNo)))
})

test('keeps detail selections separated by master and collects them in master order', () => {
  const masters = groupMasterDetailRows(rows)
  let selections = new Map()
  selections = setDocumentSelection(selections, 'SO-002', [masters[1].details[0]])
  selections = setDocumentSelection(selections, 'SO-001', [masters[0].details[1]])
  assert.deepEqual(collectDocumentSelections(masters, selections).map((row) => row.产品编码), ['CP002', 'CP003'])
})

test('links a master checkbox with all of its detail rows', () => {
  const masters = groupMasterDetailRows(rows)
  const firstDetails = masters[0].details
  const selected = toggleMasterDetails(firstDetails, [], true)
  assert.equal(selected.length, 2)
  assert.equal(allDetailsSelected(firstDetails, selected), true)
  assert.equal(someDetailsSelected(firstDetails, selected), true)
  assert.deepEqual(toggleMasterDetails(firstDetails, selected, false), [])
})

test('creates a source document containing only selected current-master details', () => {
  const master = { 单据编号: 'SO-001', detail: { items: rows.slice(0, 2), notes: [{ value: 'keep' }] } }
  const source = sourceWithSelectedDetails(master, [rows[1]], 'items')
  assert.equal(source.单据编号, 'SO-001')
  assert.deepEqual(source.detail.items.map((row) => row.产品编码), ['CP002'])
  assert.deepEqual(source.detail.notes, [{ value: 'keep' }])
})

test('maps a selected sales order detail through the shared production mapping function', () => {
  const mapped = mapSalesOrderLineToProduction(rows[0], {
    productionType: '指定级次投产',
    productionLevel: '3',
    defaultNeedDate: '2026-09-10',
  })
  assert.equal(mapped.存货编码, 'CP001')
  assert.equal(mapped.投产方式, '指定级次投产')
  assert.equal(mapped.投产级次, '3')
  assert.equal(mapped.投产数量, 2)
  assert.equal(mapped.需求日期, '2026-09-01')
  assert.equal(mapped.来源单据, '销售订单')
  assert.equal(mapped.来源单号, 'SO-001')
})
