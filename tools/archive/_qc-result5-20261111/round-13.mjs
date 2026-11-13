const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
// 对话框还开着(上一轮),勾第一行并确定导入
const step = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  if (!dlg) return 'NO-DIALOG'
  const tr = dlg.querySelector('.el-table__body tbody tr')
  const cb = tr ? tr.querySelector('.el-checkbox') : null
  if (cb && !cb.classList.contains('is-checked')) cb.click()
  return 'CHECKED:' + (cb ? cb.classList.contains('is-checked') : 'no-cb')
})
console.log(step)
await page.waitForTimeout(900)

const confirmed = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  const btn = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').includes('确定导入'))
  if (!btn) return 'NO-CONFIRM'
  if (btn.disabled) return 'DISABLED'
  btn.click()
  return 'CONFIRMED:' + (btn.textContent || '').trim()
})
console.log(confirmed)
await page.waitForTimeout(4000)

const after = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const cells = [...document.querySelectorAll('.qr-head-table .qr-value')]
  const dateInputs = [...document.querySelectorAll('.qr-head-table input')].map((i) => ({ ph: i.placeholder, v: i.value }))
  return {
    headVals: cells.map((c) => (txt(c) || '').slice(0, 24)),
    dateInputs,
    msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
    rows: [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) => ({
      item: (() => { const s = tr.querySelector('td.c-item .el-select__selected-item'); return s ? txt(s) : null })(),
      res: [...tr.querySelectorAll('td.c-res')].map((c) => { const i = c.querySelector('input'); return i ? i.value : (txt(c) || '') }),
    })),
  }
})
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-13.png' })
