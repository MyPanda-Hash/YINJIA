/* round-15.mjs — 整页刷新后:定位「折叠棉」并立刻(400ms)读高亮行 */
const task = await taskSpace('qc-carry-20261112')
const page = task.page('p1')

await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)

const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.innerText || '').trim() === '查询定位')
  if (!b) return 'no-btn'
  b.click()
  return 'clicked'
})
console.log('点查询定位 ->', clicked)
await page.waitForSelector('.el-dialog', { timeout: 8000 }).catch(() => { })
await page.waitForTimeout(800)

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
console.log('填物料名称 ->', filled)
await page.waitForTimeout(300)
await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  const btns = [...dlg.querySelectorAll('button')].filter((b) => (b.textContent || '').trim() === '查询')
  if (btns.length) btns[btns.length - 1].click()
})
await page.waitForTimeout(450)

const out = await page.evaluate(() => {
  const hit = document.querySelector('.cs-table tbody tr.is-hit')
  return {
    rows: document.querySelectorAll('.cs-table tbody tr').length,
    bar: ((document.querySelector('.cs-locate') || {}).innerText || '').replace(/\s+/g, ' ').trim(),
    hitCount: document.querySelectorAll('.cs-table tbody tr.is-hit').length,
    hitText: hit ? [...hit.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 5).join(' | ') : '',
    toasts: [...document.querySelectorAll('.el-message')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log(JSON.stringify(out, null, 2))
