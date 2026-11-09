// round-49:打印弹窗表头/首行/输入框精度核对
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(5000)
await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261105-05') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2200)
await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const g = [...document.querySelectorAll('.tb-group')].find((el) => txt(el).startsWith('打印'))
  const main = g?.querySelector('.tb-main') || g?.querySelector('button')
  if (main) main.click()
})
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => txt(d).includes('打印采购订单'))
  const headers = [...dlg.querySelectorAll('.el-table__header th')].map(txt)
  const tr = dlg.querySelector('.el-table__body tbody tr')
  const cells = tr ? [...tr.children].map((td) => txt(td)) : []
  const inputs = [...dlg.querySelectorAll('.el-table__body tbody tr .el-input-number input')].map((i) => i.value)
  const tip = txt(dlg.querySelector('.pup-quota-tip'))
  return { headers, cells, inputs, tip }
})
console.log(JSON.stringify(info, null, 1))
await page.keyboard.press('Escape')
