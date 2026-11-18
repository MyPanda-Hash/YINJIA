const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
await page.click('loc=css:.query-date-range', { label: '打开单据日期区间' })
await page.waitForTimeout(1200)
const info = await page.evaluate(() => ({
  panels: [...document.querySelectorAll('.el-picker-panel')].length,
  shortcuts: [...document.querySelectorAll('.el-picker-panel__shortcut')].map((s) => s.textContent.trim()),
  header: [...document.querySelectorAll('.el-date-range-picker__header')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-report-daterange-20261118/round-17.png' })
