const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0001', { timeout: 60000 })
await page.waitForTimeout(8000)

// 上一轮填的值若没保存到库里会丢失,这里重新填一遍(幂等:填同样的值)
await page.evaluate(() => {
  const addBar = document.querySelector('.qr-addbar .qr-add')
  let rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  if (rows.length < 2 && addBar) { addBar.click(); addBar.click() }
})
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  rows.forEach((tr, i) => {
    const std = tr.querySelector('td.c-std input')
    if (std) setVal(std, i === 0 ? '436±0.5/5mm' : '1100±(±10)')
    const cells = [...tr.querySelectorAll('td.c-res input')]
    const vals = i === 0 ? ['1.1', '2.2', '3.3', '4.4', '5.5'] : ['9.1', '9.2', '', '', '']
    cells.forEach((el, gi) => { if (vals[gi]) setVal(el, vals[gi]) })
  })
})
await page.waitForTimeout(800)

const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.approval-side button, .approval-side .el-button')]
    .find((b) => (b.textContent || '').replace(/\s+/g, '') === '保存')
  if (!btn) return 'NO-SAVE'
  btn.click()
  return 'SAVED-CLICK'
})
console.log(clicked)
await page.waitForTimeout(5000)

const after = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  return {
    side: (txt(document.querySelector('.approval-side')) || '').slice(0, 90),
    msgs: [...document.querySelectorAll('.el-message, .el-message__content')].map((m) => (m.textContent || '').trim()),
    rows: rows.map((tr) => ({
      res: [...tr.querySelectorAll('td.c-res')].map((c) => { const i = c.querySelector('input'); return i ? i.value : (txt(c) || '') }),
      editable: !!tr.querySelector('td.c-res input'),
    })),
    sideText: [...document.querySelectorAll('.approval-side li, .approval-side .as-item, .approval-side button')].map((b) => (b.textContent || '').replace(/\s+/g, '').trim()).filter(Boolean).slice(0, 20),
  }
})
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-07.png' })
