// round-08:重打包后再确认 8090 仍正常(注释改动后重 build → 入口 chunk 变了)
const task = await taskSpace('wo-board-column-settings-20261118')
const page = await task.newPage()
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(7000)
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
  锁定: [...document.querySelectorAll('.csd-item.is-locked .csd-label')].map((e) => e.textContent.trim()),
}))))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-column-settings-20261118/round-08-8090-rebuilt.png' })
