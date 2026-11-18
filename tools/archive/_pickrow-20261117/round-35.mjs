const task = await taskSpace('pickrow-eval-20261117')
const page = task.page('p1')

const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsr-grid tr')]
  const hit = rows.find((tr) => (tr.textContent || '').includes('YJ-20261116-04'))
  if (!hit) return false
  hit.click()
  return true
})
console.log('docPicked=' + picked)
await page.waitForTimeout(5000)

const head = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const vals = [...document.querySelectorAll('input')].filter(vis).map((i) => i.value)
  return { docNo: vals.find((v) => /^YJ-\d{8}/.test(v)) || vals.find((v) => /^PO-/.test(v)) || '' }
})
console.log('currentDoc=' + JSON.stringify(head))

// 打印 ▼ → 打印材料码
const opened = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')]
  const g = groups.find((el) => el.querySelector('.act-name')?.textContent.trim() === '打印')
  const caret = g?.querySelector('.tb-caret')
  if (!caret) return 'no-caret'
  caret.click()
  return 'clicked'
})
console.log('caret=' + opened)
await page.waitForTimeout(1000)
const hit = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.tb-menu .ctx-item')]
  const item = items.find((d) => (d.textContent || '').trim() === '打印材料码')
  if (!item) return 'missing:' + items.map((d) => d.textContent.trim()).join(',')
  item.click()
  return 'clicked'
})
console.log('materialLabel=' + hit)
await page.waitForTimeout(7000)

const state = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  if (!dlg) return { dialog: null }
  const rows = [...dlg.querySelectorAll('.el-table__body-wrapper tr.el-table__row')]
  return {
    title: (dlg.querySelector('.el-dialog__title')?.textContent || '').trim(),
    rows: rows.map((tr) => {
      const inputs = [...tr.querySelectorAll('.el-input-number input')]
      return {
        text: (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
        checked: !!tr.querySelector('.el-checkbox.is-checked'),
        cls: tr.className,
        qtyDisabled: inputs[0]?.disabled,
        qtyVal: inputs[0]?.value,
        boxDisabled: inputs[1]?.disabled,
      }
    }),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pickrow-eval-20261117/v9-materiallabel.png' })
