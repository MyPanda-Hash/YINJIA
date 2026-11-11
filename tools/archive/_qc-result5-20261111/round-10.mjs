const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0001', { timeout: 60000 })
await page.waitForTimeout(8000)

const setVal = `(el, v) => {
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
}`

// ① 加两行
await page.evaluate(() => {
  const add = document.querySelector('.qr-addbar .qr-add')
  if (add) { add.click(); add.click() }
})
await page.waitForTimeout(1200)

// ② 检验项:点开下拉 + 输入 + 回车(allow-create)
const pick = await page.evaluate((setValSrc) => {
  const setVal = eval(setValSrc)
  const items = ['外观', '尺寸']
  const rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  const log = []
  rows.forEach((tr, i) => {
    const inp = tr.querySelector('td.c-item input')
    if (!inp) { log.push('no-input'); return }
    inp.focus()
    inp.click()
    setVal(inp, items[i] || '外观')
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
    log.push('typed:' + (items[i] || '外观'))
  })
  return log
}, setVal)
console.log(JSON.stringify(pick))
await page.waitForTimeout(1500)

// ③ 五格 + 检测标准
await page.evaluate((setValSrc) => {
  const setVal = eval(setValSrc)
  const rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  rows.forEach((tr, i) => {
    const std = tr.querySelector('td.c-std input')
    if (std) setVal(std, i === 0 ? '436±0.5/5mm' : '1100±(±10)')
    const cells = [...tr.querySelectorAll('td.c-res input')]
    const vals = i === 0 ? ['1.1', '2.2', '3.3', '4.4', '5.5'] : ['9.1', '9.2', '', '', '']
    cells.forEach((el, gi) => { if (vals[gi]) setVal(el, vals[gi]) })
  })
}, setVal)
await page.waitForTimeout(800)

const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  return rows.map((tr) => ({
    itemSel: (() => { const s = tr.querySelector('td.c-item .el-select__selected-item'); return s ? txt(s) : null })(),
    itemInput: tr.querySelector('td.c-item input') ? tr.querySelector('td.c-item input').value : null,
    res: [...tr.querySelectorAll('td.c-res')].map((c) => { const i = c.querySelector('input'); return i ? i.value : (txt(c) || '') }),
  }))
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-10.png' })
