const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 纸面副标题里的「设备名称」下拉:选一台设备,登记表应带出该设备的行/单
await page.click('css:.rsp-subtitle .el-select, .rsp-sheet .el-select')
await page.waitForTimeout(1200)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown')]
  .filter((d) => d.offsetParent !== null)
  .map((d) => [...d.querySelectorAll('li')].map((li) => (li.textContent || '').trim())))
console.log('opts=' + JSON.stringify(opts))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-39-subtitle.png' })
