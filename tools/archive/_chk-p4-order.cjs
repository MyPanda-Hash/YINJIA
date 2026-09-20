/**
 * _chk-p4-order.cjs — 推演第 4 页各块的实际渲染顺序
 *
 * 模板里的次序是: cfg.sections → cfg.dataTables → cfg.tailDocSections → cfg.tailSections
 * 本脚本按这个次序把第 4 页(page:3)的块列出来 —— 用户报「表格在最底下」,
 * 先确认到底谁排在谁前面,别凭印象。
 *
 * 用法:node tools/archive/_chk-p4-order.cjs
 */
'use strict'

;(async () => {
  const mod = await import('file:///C:/INCER/YINJIA-MES/frontend/src/core/views/recordSheetConfigs.js')
  const c = mod.recordSheetConfigs.RD_SPEC_DOC

  const seq = []
  const slotSecs = (c.sections || []).filter((s) => s.page === 3 && s.tablesSlot)
  for (const s of c.sections || []) {
    if (s.page !== 3) continue
    seq.push({ kind: 'sections', text: s.bar || '(无 bar)', rows: (s.rows || []).length })
    // 该节标了 tablesSlot 时,模板会在这一节之后就地渲染 tablesAfterBar 匹配它的表
    for (const d of c.dataTables || []) {
      if (d.page !== 3) continue
      if (!s.tablesSlot || d.tablesAfterBar !== s.bar) continue
      const cols = (d.cols || []).filter((x) => !x.hiddenCol).map((x) => x.key)
      seq.push({ kind: 'dataTables(就地)', text: '表头=' + JSON.stringify(cols) })
    }
  }
  // 未被 tablesAfterBar 托管的表仍走模板后面那段(排在所有 sections 之后)
  for (const d of c.dataTables || []) {
    if (d.page !== 3) continue
    if (d.tablesAfterBar) continue
    const cols = (d.cols || []).filter((x) => !x.hiddenCol).map((x) => x.key)
    seq.push({ kind: 'dataTables(末尾段)', text: '表头=' + JSON.stringify(cols) })
  }
  void slotSecs
  for (const s of c.tailDocSections || []) {
    if (s.page !== 3) continue
    seq.push({ kind: 'tailDocSections', text: s.bar || '(无 bar)' })
  }
  for (const s of c.tailSections || []) {
    if (s.page !== 3) continue
    seq.push({ kind: 'tailSections', text: s.bar || '(无 bar)' })
  }

  console.log('第 4 页渲染顺序(按模板次序):')
  seq.forEach((x, i) => {
    const extra = x.rows !== undefined ? `  rows=${x.rows}` : ''
    console.log(`  ${String(i + 1).padStart(2)}. [${x.kind}] ${x.text}${extra}`)
  })

  const tblIdx = seq.findIndex((x) => x.kind.startsWith('dataTables'))
  const lastIdx = seq.length - 1
  const sec1Idx = seq.findIndex((x) => x.text.startsWith('1.关键物料列表'))
  console.log('')
  console.log(tblIdx === sec1Idx + 1
    ? '✓ 数据表紧跟「1.关键物料列表」标题之后(符合设计 B4→B6)'
    : `✗ 数据表不在标题之后(标题第 ${sec1Idx + 1} 块,数据表第 ${tblIdx + 1} 块)`)
  console.log(tblIdx === lastIdx
    ? '⚠ 数据表排在最后一块(用户报「在最底下」的就是这种)'
    : `数据表位于第 ${tblIdx + 1} / ${seq.length} 块(不在末尾)`)
})()
