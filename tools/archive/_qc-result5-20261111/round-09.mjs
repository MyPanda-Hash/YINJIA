const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
const clicked = await page.evaluate(() => {
  const btn = document.querySelector('.approval-side .as-side-btn.primary')
  if (!btn) return 'NO-BTN'
  const label = (btn.textContent || '').replace(/\s+/g, '')
  btn.click()
  return 'CLICKED:' + label
})
console.log(clicked)
await page.waitForTimeout(6000)

const after = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  return {
    status: (txt(document.querySelector('.approval-side')) || '').slice(0, 60),
    msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
    rows: rows.map((tr) => ({
      res: [...tr.querySelectorAll('td.c-res')].map((c) => { const i = c.querySelector('input'); return i ? i.value : (txt(c) || '') }),
      editable: !!tr.querySelector('td.c-res input'),
    })),
    btnLabels: [...document.querySelectorAll('.approval-side .as-side-btn')].map((b) => (b.textContent || '').replace(/\s+/g, '')),
  }
})
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-09.png' })
