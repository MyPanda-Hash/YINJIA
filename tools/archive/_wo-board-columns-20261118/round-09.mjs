// round-09:共用同一个 ColumnSettingsDialog 的另一页(生产工单·列表)回归 —— 没有 locked 列时不应出现锁图标/多余提示
const task = await taskSpace('wo-board-column-settings-20261118')
const page = await task.newPage()

await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 40000 })
await page.waitForTimeout(6000)
const st = await page.evaluate(() => ({
  hash: location.hash,
  列设置按钮: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === '列设置'),
  表头列数: document.querySelectorAll('.el-table__header th').length,
}))
console.log(JSON.stringify(st))

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '列设置')
  if (btn) btn.click()
})
await page.waitForTimeout(1200)
console.log(JSON.stringify(await page.evaluate(() => ({
  弹窗: !!document.querySelector('.csd-dialog .csd-list'),
  锁定条目数: document.querySelectorAll('.csd-item.is-locked').length,
  锁图标数: document.querySelectorAll('.csd-lock').length,
  提示条数: document.querySelectorAll('.csd-dialog .csd-tip').length,
  条目数: document.querySelectorAll('.csd-item').length,
}))))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-column-settings-20261118/round-09-workorderlist-dialog.png' })
