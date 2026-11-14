const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
console.log('open=' + await page.evaluate(() => {
  const els = [...document.querySelectorAll('.qr-ref-ctl')]
  const el = els[1] || els[0]
  if (!el) return 'NO-REF'
  el.click(); return 'CLICKED'
}))
await page.waitForTimeout(3500)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return
  const inp = [...d.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('过滤'))
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, 'YJ-XH-001')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  const b = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '查询')
  if (b) b.click()
})
await page.waitForTimeout(2500)
console.log('rows=' + await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return d ? d.querySelectorAll('.el-table__body tbody tr').length : -1
}))
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const tr = d && d.querySelector('.el-table__body tbody tr')
  const cb = tr && tr.querySelector('.el-checkbox')
  if (cb && !cb.classList.contains('is-checked')) cb.click()
})
await page.waitForTimeout(900)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const b = d && [...d.querySelectorAll('button')].find((x) => (x.textContent || '').includes('确定导入'))
  if (b && !b.disabled) b.click()
})
await page.waitForTimeout(8000)
const rows = await page.evaluate(() => [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) => {
  const item = tr.querySelector('td.c-item')
  const std = tr.querySelector('td.c-std textarea')
  const method = tr.querySelector('td.c-method textarea') || tr.querySelector('td.c-method input')
  return { 检验项: item ? (item.textContent || '').replace(/\s+/g, ' ').trim() : '', 检测标准: std ? std.value.slice(0, 24) : '', 检验方法: method ? method.value.slice(0, 24) : '' }
}))
console.log(JSON.stringify(rows, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-99-carry.png' })
