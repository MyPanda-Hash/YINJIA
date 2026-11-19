const task = await taskSpace('plan-board-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 30000 })
await page.waitForTimeout(4000)
await page.click('.report-table tbody .el-checkbox >> nth=0', { label: 'select row 1' })
await page.click('.report-table tbody .el-checkbox >> nth=2', { label: 'select row 3' })
await page.waitForTimeout(300)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tools .tb-main')].find((x) => x.textContent.includes('导出报表'))
  if (el) el.click()
})
await page.waitForTimeout(700)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent && x.innerText.includes('报工记录为明细表'))
  return d ? d.innerText.replace(/\s+/g, ' ').trim() : ''
})
console.log('DIALOG:', dlg)
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-plan-board-20261119/report-export-dialog.png' })
// 勾 0 行时勾选行入口要提示、不能静默导全部:先取消选择再点勾选行导出
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent && x.innerText.includes('报工记录为明细表'))
  const cancel = [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消')
  if (cancel) cancel.click()
})
await page.waitForTimeout(400)
await page.click('.report-table tbody .el-checkbox >> nth=0', { label: 'unselect row 1' }).catch(() => {})
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tools .tb-main')].find((x) => x.textContent.includes('导出报表'))
  if (el) el.click()
})
await page.waitForTimeout(500)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.el-dialog .efmt-item')].find((x) => x.innerText.includes('勾选行'))
  if (el) el.click()
})
await page.waitForTimeout(800)
console.log('MSG:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => m.innerText.trim()))))
