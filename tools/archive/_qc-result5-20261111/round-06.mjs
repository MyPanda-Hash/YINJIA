const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0001', { timeout: 60000 })
await page.waitForTimeout(8000)

// ① 加两行检验项
const added = await page.evaluate(() => {
  const bar = document.querySelector('.qr-addbar .qr-add')
  if (!bar) return 'NO-ADDBAR'
  bar.click(); bar.click()
  return 'ADDED'
})
console.log(added)
await page.waitForTimeout(1200)

// ② 第一行五格填 1.1 / 2.2 / 3.3 / 4.4 / 5.5,第二行只填两格;顺带填检测标准
const filled = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  const out = []
  rows.forEach((tr, i) => {
    const std = tr.querySelector('td.c-std input')
    if (std) setVal(std, i === 0 ? '436±0.5/5mm' : '1100±(±10)')
    const cells = [...tr.querySelectorAll('td.c-res input')]
    out.push(cells.length)
    const vals = i === 0 ? ['1.1', '2.2', '3.3', '4.4', '5.5'] : ['9.1', '9.2', '', '', '']
    cells.forEach((el, gi) => { if (vals[gi]) setVal(el, vals[gi]) })
  })
  return { rows: rows.length, resultInputsPerRow: out }
})
console.log(JSON.stringify(filled))
await page.waitForTimeout(800)

const shot = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  return rows.map((tr) => ({
    std: txt(tr.querySelector('td.c-std')),
    results: [...tr.querySelectorAll('td.c-res')].map((c) => { const i = c.querySelector('input'); return i ? i.value : (txt(c) || '') }),
  }))
})
console.log(JSON.stringify(shot, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-06.png' })
