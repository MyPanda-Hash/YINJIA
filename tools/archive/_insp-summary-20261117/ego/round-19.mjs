// round-19:English 下展开列表头必须是 Expand(不是 records)
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3500)
const zh = await page.evaluate(() => localStorage.getItem('mes_locale'))
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload()
await page.waitForTimeout(4500)
console.log(JSON.stringify(await page.evaluate(() => ({
  headers: [...document.querySelectorAll('.iss-tabs .el-tab-pane:nth-child(1) .el-table__header th')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 4),
  empty: [...document.querySelectorAll('.iss-table .el-table__empty-text')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
}))))
await page.evaluate((v) => localStorage.setItem('mes_locale', v || 'zh-CN'), zh)
await page.reload()
await page.waitForTimeout(1500)
await task.finish({ keep: [] })
