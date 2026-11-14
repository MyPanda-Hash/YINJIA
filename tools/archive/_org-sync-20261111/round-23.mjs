const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.evaluate(() => { const el = document.querySelector('.qr-ref-ctl'); if (el) el.click() })
await page.waitForTimeout(3000)
const checked = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  if (!dlg) return 'NO-DIALOG'
  const tr = dlg.querySelector('.el-table__body tbody tr')
  const cb = tr ? tr.querySelector('.el-checkbox') : null
  if (cb && !cb.classList.contains('is-checked')) cb.click()
  return 'ROW1:' + (tr ? (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : '?')
})
console.log(checked)
await page.waitForTimeout(800)
const confirmed = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  const btn = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').includes('确定导入'))
  if (!btn) return 'NO-BTN'
  if (btn.disabled) return 'DISABLED'
  btn.click()
  return 'CONFIRMED:' + (btn.textContent || '').trim()
})
console.log(confirmed)
await page.waitForTimeout(5000)
const head = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    headVals: [...document.querySelectorAll('.qr-head-table .qr-value')].map((c) => (txt(c) || '').slice(0, 16)),
    insp: (txt(document.querySelectorAll('.qr-foot-table tr')[2]) || '').slice(0, 40),
    rows: document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr').length,
    addBar: !!document.querySelector('.qr-addbar .qr-add'),
  }
})
console.log(JSON.stringify(head, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-23-material.png' })
