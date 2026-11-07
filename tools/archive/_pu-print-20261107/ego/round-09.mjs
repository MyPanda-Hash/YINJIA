// round-09:定位左栏 YJ-20261012-11 行(诊断可见性)→ 点选 → 开打印弹窗
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.waitForTimeout(500)

const diag = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const hits = [...document.querySelectorAll('tbody tr')].filter((r) => txt(r).includes('YJ-20261012-11'))
  return hits.map((r) => {
    const b = r.getBoundingClientRect()
    return { text: txt(r).slice(0, 60), w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), cls: r.className }
  })
})
console.log('hits=' + JSON.stringify(diag, null, 2))

const clicked = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (!row) return 'no visible row'
  row.scrollIntoView({ block: 'center' })
  row.click()
  return 'clicked row'
})
console.log(clicked)
await page.waitForTimeout(2500)

const afterSelect = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    railText: txt(document.querySelector('.doc-select-rail')).slice(0, 200),
    topInfo: txt(document.querySelector('.doc-rail-main')).slice(0, 300),
    toolbar: [...document.querySelectorAll('.tb-group')].map(txt),
  }
})
console.log(JSON.stringify(afterSelect, null, 2))

const opened = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-group .tb-main')].find((n) => (n.textContent || '').trim() === '打印')
  if (!el) return 'no print main'
  el.click()
  return 'clicked print'
})
console.log(opened)
await page.waitForTimeout(3000)

const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  if (!root) return { open: false, tail: txt(document.body).slice(-300) }
  const rows = [...root.querySelectorAll('.el-table__body tbody tr')]
  return {
    open: true,
    title: txt(document.querySelector('.el-dialog__header')),
    rowCount: rows.length,
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
    headers: [...root.querySelectorAll('.el-table__header th')].map(txt),
    rows: rows.map(txt),
    qtyInputs: [...root.querySelectorAll('.el-input-number input')].map((i) => i.value),
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log(JSON.stringify(dlg, null, 2))
