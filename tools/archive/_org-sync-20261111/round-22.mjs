const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 60000 })
await page.waitForTimeout(7000)
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.approval-side .as-side-btn')].find((b) => (b.textContent || '').replace(/\s+/g, '') === '新增')
  if (!btn) return 'NO-ADD'
  btn.click()
  return 'ADD-CLICKED'
})
console.log(clicked)
await page.waitForTimeout(5000)
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    side: (txt(document.querySelector('.approval-side')) || '').slice(0, 60),
    addBar: !!document.querySelector('.qr-addbar .qr-add'),
    headVals: [...document.querySelectorAll('.qr-head-table .qr-value')].map((c) => (txt(c) || '').slice(0, 20)),
    rows: document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr').length,
    refCtl: document.querySelectorAll('.qr-ref-ctl').length,
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-22-new.png' })
