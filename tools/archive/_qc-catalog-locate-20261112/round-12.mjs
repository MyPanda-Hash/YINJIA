/* round-12.mjs — 再测一次:定位成功应有「已定位 N 行」成功提示 */
const task = await taskSpace('qc-carry-20261112')
const page = task.page('p1')

await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)

const rowsCount = () => page.evaluate(() => document.querySelectorAll('.cs-table tbody tr').length)
console.log('初始行数 ->', await rowsCount())

await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.innerText || '').trim() === '查询定位')
  if (b) b.click()
})
await page.waitForTimeout(1500)

const filled = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  if (!dlg) return 'no-dialog'
  const lab = [...dlg.querySelectorAll('label')].find((el) => (el.textContent || '').trim() === '物料名称')
  if (!lab) return 'no-label'
  let box = lab.parentElement
  let input = null
  for (let i = 0; i < 4 && box && !input; i++) { input = box.querySelector('input'); if (!input) box = box.parentElement }
  if (!input) return 'no-input'
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(input, '折叠棉')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'filled'
})
console.log('填物料名称=折叠棉 ->', filled)
await page.waitForTimeout(400)
await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  const btns = [...dlg.querySelectorAll('button')].filter((b) => (b.textContent || '').trim() === '查询')
  if (btns.length) btns[btns.length - 1].click()
})
await page.waitForTimeout(2500)

const out = await page.evaluate(() => ({
  rows: document.querySelectorAll('.cs-table tbody tr').length,
  bar: ((document.querySelector('.cs-locate') || {}).innerText || '').replace(/\s+/g, ' ').trim(),
  toasts: [...document.querySelectorAll('.el-message')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()),
  hit: document.querySelectorAll('.cs-table tbody tr.is-hit').length,
}))
console.log('定位后 ->', JSON.stringify(out, null, 2))
