/* round-11.mjs — 待检验目录:查询=数据定位(条件筛选行 + 定位条 + 清除) */
const task = await taskSpace('qc-carry-20261112')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_CATALOG', { timeout: 60000 })
await page.waitForTimeout(9000)

const state = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll('.cs-table tbody tr')]
  const locateBar = document.querySelector('.cs-locate')
  const railButtons = [...document.querySelectorAll('.as-side-btn')].map((el) => (el.innerText || '').trim())
  return {
    sheetTitle: ((document.querySelector('.cs-title') || {}).innerText || '').trim(),
    tableRows: rows.length,
    locateBar: locateBar ? (locateBar.innerText || '').replace(/\s+/g, ' ').trim() : '',
    hitRows: document.querySelectorAll('.cs-table tbody tr.is-hit').length,
    railFind: railButtons.slice(0, 4),
    firstRowCells: rows[0] ? [...rows[0].querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 6) : [],
  }
})
console.log('初始 ->', JSON.stringify(await state(), null, 2))

// 点右侧「查询定位」
const opened = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.innerText || '').trim() === '查询定位')
  if (!b) return 'no-btn'
  b.click()
  return 'clicked'
})
console.log('查询定位 ->', opened)
await page.waitForTimeout(1500)

// 弹窗里填「批次号」= 20260922
const filled = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  if (!dlg) return 'no-dialog'
  const labs = [...dlg.querySelectorAll('label')]
  const lab = labs.find((el) => (el.textContent || '').trim() === '批次号')
  if (!lab) return 'no-label:' + labs.map((l) => (l.textContent || '').trim()).join('|')
  let box = lab.parentElement
  let input = null
  for (let i = 0; i < 4 && box && !input; i++) { input = box.querySelector('input'); if (!input) box = box.parentElement }
  if (!input) return 'no-input'
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(input, '20260922')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'filled'
})
console.log('填批次号 ->', filled)
await page.waitForTimeout(400)

const submitted = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  const btns = [...dlg.querySelectorAll('button')].filter((b) => (b.textContent || '').trim() === '查询')
  if (!btns.length) return 'no-btn'
  btns[btns.length - 1].click()
  return 'clicked'
})
console.log('提交 ->', submitted)
await page.waitForTimeout(2500)
const afterQuery = await state()
const toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('定位后 ->', JSON.stringify({ ...afterQuery, toasts }, null, 2))

// 清除定位
await page.evaluate(() => {
  const c = document.querySelector('.cs-locate-clear')
  if (c) c.click()
})
await page.waitForTimeout(1200)
console.log('清除后 ->', JSON.stringify(await state(), null, 2))
