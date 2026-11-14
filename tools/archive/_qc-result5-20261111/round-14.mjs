const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.waitForTimeout(1000)

const add = await page.evaluate(() => {
  const b = document.querySelector('.qr-addbar .qr-add')
  if (!b) return 'NO-ADD'
  b.click(); b.click()
  return 'ADDED'
})
console.log(add)
await page.waitForTimeout(1500)

const fill = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const items = ['外观', '尺寸']
  const rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  rows.forEach((tr, i) => {
    const inp = tr.querySelector('td.c-item input')
    if (inp) {
      inp.focus(); inp.click()
      setVal(inp, items[i] || '外观')
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
    }
    const std = tr.querySelector('td.c-std input')
    if (std) setVal(std, i === 0 ? '436±0.5/5mm' : '1100±(±10)')
    const cells = [...tr.querySelectorAll('td.c-res input')]
    const vals = i === 0 ? ['1.1', '2.2', '3.3', '4.4', '5.5'] : ['9.1', '9.2', '', '', '']
    cells.forEach((el, gi) => { if (vals[gi]) setVal(el, vals[gi]) })
  })
  return rows.length
})
console.log('rows=' + fill)
await page.waitForTimeout(1000)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-14.png' })

await page.evaluate(() => {
  const btn = document.querySelector('.approval-side .as-side-btn.primary')
  if (btn) btn.click()
})
const msgs = []
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message, .el-message-box')]
    .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log(JSON.stringify([...new Set(msgs)], null, 2))
await page.waitForTimeout(2000)
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    status: (txt(document.querySelector('.approval-side')) || '').slice(0, 40),
    rows: [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) => ({
      item: (() => { const s = tr.querySelector('td.c-item .el-select__selected-item'); return s ? txt(s) : null })(),
      res: [...tr.querySelectorAll('td.c-res')].map((c) => { const i = c.querySelector('input'); return i ? i.value : (txt(c) || '') }),
      editable: !!tr.querySelector('td.c-res input'),
    })),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-14b.png' })
