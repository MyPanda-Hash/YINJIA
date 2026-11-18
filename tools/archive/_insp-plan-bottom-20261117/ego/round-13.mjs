// round-13:加一行并打开频率下拉,同时看网络请求与列配置
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(8000)
// 关掉可能残留的弹窗
await page.evaluate(() => {
  document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => b.click())
})
await page.waitForTimeout(800)
// 加一行
await page.evaluate(() => {
  const add = [...document.querySelectorAll('.rs-add')][0]
  if (add) add.click()
})
await page.waitForTimeout(1500)
// 真鼠标点第 5 列的下拉
const box = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('table.rs-dt tbody tr')].find((r) => r.querySelector('td.rs-td .el-select'))
  if (!tr) return null
  const td = [...tr.querySelectorAll('td.rs-td')].find((c) => c.querySelector('.el-select'))
  const r = td.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('cell box:', JSON.stringify(box))
if (box) {
  await page.mouse.click(box.x, box.y)
  await page.waitForTimeout(1500)
}
console.log(JSON.stringify(await page.evaluate(() => ({
  stdlibReqs: performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes('stdlib')),
  visibleOptions: [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.textContent || '').trim()),
  popperText: [...document.querySelectorAll('.el-select-dropdown')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)),
  selectPlaceholder: (document.querySelector('table.rs-dt td.rs-td .el-select') || {}).textContent,
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-13.png' })
