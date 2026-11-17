// round-06 — 诊断:选单后当前状态(是否可编辑、保存按钮状态、当前单号)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]

const st = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const side = [...document.querySelectorAll('.as-side-btn')].map((e) => ({
    t: txt(e), cls: e.className,
  }))
  const sheetRoot = document.querySelector('.fi-sheet, [data-fi-sheet]')
  const selRow = document.querySelector('.el-table__body-wrapper tbody tr.current-row, .el-table__body-wrapper tbody tr.is-current, .el-table__body-wrapper tbody tr.ds-sel-row')
  const noEls = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length > 2) continue
    const t = txt(el)
    if (/^SJ-\d{4}-\d{2}-\d{4}$/.test(t)) noEls.push({ t, tag: el.tagName, cls: el.className, vis: el.offsetParent !== null })
  }
  return {
    hash: location.hash,
    sheetRootClass: sheetRoot ? sheetRoot.className : null,
    sampleInputs: document.querySelectorAll('.sample-row input').length,
    sampleRows: document.querySelectorAll('.sample-row').length,
    gzY: document.querySelectorAll('.sample-row td.gz-y').length,
    side,
    selRowText: txt(selRow),
    noEls: noEls.slice(0, 12),
    docStatusText: (() => {
      const cands = [...document.querySelectorAll('.doc-status, .status-tag, .el-tag')].map((e) => txt(e)).filter(Boolean)
      return cands.slice(0, 10)
    })(),
    tableRowCount: document.querySelectorAll('.el-table__body-wrapper tbody tr').length,
    bodyFirstLines: (document.body.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 25),
  }
})
console.log('STATE=' + JSON.stringify(st, null, 1))
console.log('DONE round-06')
