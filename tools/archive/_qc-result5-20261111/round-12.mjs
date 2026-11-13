const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0001', { timeout: 60000 })
await page.waitForTimeout(8000)

const probe = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const cells = [...document.querySelectorAll('.qr-head-table .qr-value')]
  return {
    headCells: cells.map((c) => ({ cls: c.className, t: (txt(c) || '').slice(0, 20), ref: !!c.querySelector('.qr-ref-ctl') })),
    refCtlCount: document.querySelectorAll('.qr-ref-ctl').length,
  }
})
console.log(JSON.stringify(probe, null, 2))

// 点「物料名称」参照格(第一个 .qr-ref-ctl)
const clicked = await page.evaluate(() => {
  const el = document.querySelector('.qr-ref-ctl')
  if (!el) return 'NO-REF'
  el.click()
  return 'CLICKED-REF'
})
console.log(clicked)
await page.waitForTimeout(3000)

const dialog = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const dlg = document.querySelector('.el-dialog')
  const table = dlg ? dlg.querySelector('.el-table') : null
  return {
    title: dlg ? txt(dlg.querySelector('.el-dialog__title')) : null,
    inputs: dlg ? [...dlg.querySelectorAll('input')].map((i) => i.placeholder || '(no-ph)') : null,
    rows: table ? table.querySelectorAll('tbody tr').length : 0,
    firstRows: table ? [...table.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => txt(tr)) : null,
    buttons: dlg ? [...dlg.querySelectorAll('button')].map((b) => txt(b)) : null,
  }
})
console.log(JSON.stringify(dialog, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-12.png' })
