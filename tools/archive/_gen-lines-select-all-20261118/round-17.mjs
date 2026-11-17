import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 30000 })
await page.waitForTimeout(4000)

// 左栏模糊搜索:用户截图里那两张单的单号前缀
await page.evaluate(() => {
  const input = document.querySelector('.dsr-kw input')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(input, 'YJ-20261012')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  document.querySelector('.dsr-kw button')?.click()
})
await page.waitForTimeout(3000)

const rows = await page.evaluate(() => [...document.querySelectorAll('.dsr-grid tbody tr')].map((tr) => {
  const tds = [...tr.querySelectorAll('td')]
  return { no: (tds[1]?.textContent || '').trim(), st: (tds[tds.length - 1]?.textContent || '').trim() }
}))
console.log(JSON.stringify(rows.slice(0, 12)))
console.log('approved', rows.filter((r) => r.st === '已审核').length)
