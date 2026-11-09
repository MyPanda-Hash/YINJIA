// round-07:关弹窗 → 左栏搜一张多行订单(YJ-20260901-03) → 再开打印弹窗,看行数
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.waitForTimeout(500)
// 关闭弹窗(ESC)
await page.keyboard.press('Escape')
await page.waitForTimeout(800)

const railInputs = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    inputs: [...document.querySelectorAll('.doc-select-rail input')].map((i) => ({ ph: i.placeholder, cls: i.className })),
    railButtons: [...document.querySelectorAll('.doc-select-rail button')].map(txt),
    railText: txt(document.querySelector('.doc-select-rail')).slice(0, 300),
  }
})
console.log(JSON.stringify(railInputs, null, 2))

// 用左栏搜索框过滤单号
const filled = await page.evaluate(() => {
  const inp = document.querySelector('.doc-select-rail input')
  if (!inp) return false
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, 'YJ-20260901-03')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  return true
})
console.log('rail search filled=' + filled)
await page.waitForTimeout(2500)
const afterSearch = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return [...document.querySelectorAll('tbody tr')].map(txt).filter(Boolean).slice(0, 8)
})
console.log('rail rows after search=' + JSON.stringify(afterSearch, null, 2))
