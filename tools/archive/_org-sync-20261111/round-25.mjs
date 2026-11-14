const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
// ① 选物料(导入会重载单据,所以必须放在填表之前)
await page.evaluate(() => { const el = document.querySelector('.qr-ref-ctl'); if (el) el.click() })
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  const tr = dlg && dlg.querySelector('.el-table__body tbody tr')
  const cb = tr && tr.querySelector('.el-checkbox')
  if (cb && !cb.classList.contains('is-checked')) cb.click()
})
await page.waitForTimeout(700)
console.log(await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  const btn = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').includes('确定导入'))
  if (!btn || btn.disabled) return 'NO-BTN'
  btn.click()
  return 'IMPORTED'
}))
await page.waitForTimeout(5000)

// ② 加两行 + 填检验项/标准/五格
console.log(await page.evaluate(() => {
  const b = document.querySelector('.qr-addbar .qr-add')
  if (!b) return 'NO-ADD'
  b.click(); b.click()
  return 'ADDED'
}))
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
    const vals = i === 0 ? ['1.1', '2.2', '3.3', '4.4', '5.5'] : ['9.1', '9.2', '9.3', '', '']
    cells.forEach((el, gi) => { if (vals[gi]) setVal(el, vals[gi]) })
  })
  return { rows: rows.length, head: [...document.querySelectorAll('.qr-head-table .qr-label')].length }
})
console.log(JSON.stringify(fill))
await page.waitForTimeout(800)

// ③ 保存
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.approval-side .as-side-btn')].find((b) => (b.textContent || '').replace(/\s+/g, '') === '保存')
  if (btn) btn.click()
})
const msgs = []
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message, .el-message-box')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log(JSON.stringify([...new Set(msgs)]))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-25-saved.png' })
