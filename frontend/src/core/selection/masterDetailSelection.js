function text(value) {
  return value == null ? '' : String(value).trim()
}

export function sourceDocumentNo(row) {
  return text(row?.来源单号 || row?.单据编号 || row?.编号 || row?.锭号)
}

export function sourceLineKey(row, index = 0) {
  return text(row?._rowKey || row?._lineKey) || [
    sourceDocumentNo(row),
    text(row?.产品编码 || row?.存货编码),
    text(row?.需求日期 || row?.预计交货日期),
    index,
  ].join('|')
}

export function groupMasterDetailRows(rows = []) {
  const groups = new Map()
  rows.forEach((source, index) => {
    const documentNo = sourceDocumentNo(source)
    if (!documentNo) return
    let master = groups.get(documentNo)
    if (!master) {
      master = { ...source, _documentNo: documentNo, details: [] }
      groups.set(documentNo, master)
    }
    master.details.push({ ...source, _rowKey: sourceLineKey(source, index), _documentNo: documentNo })
  })
  return [...groups.values()]
}

export function selectedKeysByDocument(selectionByDocument, documentNo) {
  return new Set((selectionByDocument.get(documentNo) || []).map((row) => sourceLineKey(row)))
}

export function setDocumentSelection(selectionByDocument, documentNo, rows = []) {
  const next = new Map(selectionByDocument)
  if (rows.length) next.set(documentNo, [...rows])
  else next.delete(documentNo)
  return next
}

export function collectDocumentSelections(masters = [], selectionByDocument = new Map()) {
  const output = []
  for (const master of masters) output.push(...(selectionByDocument.get(master._documentNo) || []))
  return output
}

export function allDetailsSelected(details = [], selectedRows = []) {
  if (!details.length) return false
  const selected = new Set(selectedRows.map((row) => sourceLineKey(row)))
  return details.every((row) => selected.has(sourceLineKey(row)))
}

export function someDetailsSelected(details = [], selectedRows = []) {
  if (!details.length) return false
  const selected = new Set(selectedRows.map((row) => sourceLineKey(row)))
  return details.some((row) => selected.has(sourceLineKey(row)))
}

export function toggleMasterDetails(details = [], selectedRows = [], checked) {
  const detailKeys = new Set(details.map((row) => sourceLineKey(row)))
  const others = selectedRows.filter((row) => !detailKeys.has(sourceLineKey(row)))
  return checked ? [...others, ...details] : others
}

export function sourceWithSelectedDetails(master, selectedRows = [], detailKey = '') {
  if (!master || !selectedRows.length) return null
  const detail = { ...(master.detail || {}) }
  const key = detailKey || Object.keys(detail)[0] || 'items'
  detail[key] = [...selectedRows]
  return { ...master, detail }
}

export function mapSalesOrderLineToProduction(row, options = {}) {
  return {
    ...row,
    存货编码: row.产品编码 || row.存货编码 || '',
    存货名称: row.产品名称 || row.存货名称 || '',
    投产方式: options.productionType || '全阶投产',
    投产级次: options.productionLevel || '',
    投产数量: row.数量 || 0,
    需求日期: row.预计交货日期 || options.defaultNeedDate || '',
    来源单据: '销售订单',
    来源单号: sourceDocumentNo(row),
  }
}
