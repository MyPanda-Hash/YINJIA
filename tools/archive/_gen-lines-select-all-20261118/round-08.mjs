import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

// 关掉可能还开着的下拉
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// 1) 清空左栏勾选
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.dsr-picked button')].find((b) => (b.textContent || '').includes('清空'))
  if (btn) btn.click()
})
await page.waitForTimeout(600)

// 2) 左栏模糊搜索同一供应商(合单必须是同一供应商)
const kw = await page.evaluate(() => {
  const input = document.querySelector('.dsr-kw input')
  if (!input) return 'no-input'
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(input, '福建鑫恒')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  const btn = document.querySelector('.dsr-kw button')
  if (btn) btn.click()
  return 'searched'
})
console.log(kw)
await page.waitForTimeout(2500)

const rows = await page.evaluate(() => [...document.querySelectorAll('.dsr-grid tbody tr')].map((tr) => ({
  no: (tr.querySelectorAll('td')[1]?.textContent || '').trim(),
  sup: (tr.querySelectorAll('td')[3]?.textContent || '').trim(),
  st: (tr.querySelectorAll('td')[4]?.textContent || '').trim(),
})))
console.log(JSON.stringify(rows, null, 2))
