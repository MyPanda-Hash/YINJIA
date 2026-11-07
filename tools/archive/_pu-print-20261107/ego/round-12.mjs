// round-12:从下拉「打印订单无金额」进入 → 弹窗应为无金额版式 → 出纸也无 单价/小计
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.waitForTimeout(400)

// 打开「打印」下拉(点 ▼)
const caret = await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((el) => (el.textContent || '').includes('打印'))
  const c = g?.querySelector('.tb-caret')
  if (!c) return 'no caret'
  c.click()
  return 'clicked caret'
})
console.log(caret)
await page.waitForTimeout(800)
const items = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return [...document.querySelectorAll('.ctx-item, .tb-menu .item, .el-dropdown-menu__item')].map(txt).filter(Boolean)
})
console.log('dropdown items=' + JSON.stringify(items))

const pick = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const it = [...document.querySelectorAll('.ctx-item, .tb-menu .item, .el-dropdown-menu__item')]
    .find((el) => txt(el) === '打印订单无金额')
  if (!it) return 'no item'
  it.click()
  return 'clicked 打印订单无金额'
})
console.log(pick)
await page.waitForTimeout(3000)

const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  if (!root) return { open: false, tail: txt(document.body).slice(-300) }
  const radio = [...root.querySelectorAll('.el-radio-button')].map((el) => ({
    text: txt(el), checked: el.className.includes('is-active'),
  }))
  return {
    open: true,
    title: txt(document.querySelector('.el-dialog__header')),
    headers: [...root.querySelectorAll('.el-table__header th')].map(txt),
    radio,
    rowCount: root.querySelectorAll('.el-table__body tbody tr').length,
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log('dialog=' + JSON.stringify(dlg, null, 2))

// 打桩打印并出纸
await page.evaluate(() => {
  window.__printCalls = 0
  if (!window.__origPrint) window.__origPrint = window.print
  window.print = () => { window.__printCalls += 1 }
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('确定并打印'))
  if (btn) btn.click()
})
await page.waitForTimeout(2500)

const paper = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const host = document.getElementById('yj-print-host')
  if (!host) return { present: false, printCalls: window.__printCalls }
  const rows = [...host.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => txt(td)))
  return {
    present: true,
    printCalls: window.__printCalls,
    tableHeaders: [...host.querySelectorAll('thead th')].map(txt),
    rowCount: rows.length,
    rows: rows.slice(0, 3),
    totalRow: rows[rows.length - 1],
    hasUnitPriceHeader: txt(host).includes('单价'),
    hasSubtotalHeader: txt(host).includes('小计'),
  }
})
console.log('paper=' + JSON.stringify(paper, null, 2))

await page.evaluate(() => {
  if (window.__origPrint) window.print = window.__origPrint
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
})
