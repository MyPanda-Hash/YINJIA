import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

// 1) 清空勾选
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.dsr-picked button')].find((b) => (b.textContent || '').includes('清空'))
  btn?.click()
})
await page.waitForTimeout(500)

// 2) 搜单号前缀 PO-2026-10(这批是已审核的采购订单)
await page.evaluate(() => {
  const input = document.querySelector('.dsr-kw input')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(input, 'PO-2026-10')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  document.querySelector('.dsr-kw button')?.click()
})
await page.waitForTimeout(3000)

const rows = await page.evaluate(() => [...document.querySelectorAll('.dsr-grid tbody tr')].map((tr) => ({
  no: (tr.querySelectorAll('td')[1]?.textContent || '').trim(),
  st: (tr.querySelectorAll('td')[tr.querySelectorAll('td').length - 1]?.textContent || '').trim(),
})))
console.log(JSON.stringify(rows.slice(0, 8)))
console.log('total rows', rows.length, 'approved', rows.filter((r) => r.st === '已审核').length)
