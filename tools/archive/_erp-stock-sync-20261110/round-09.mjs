// round-09:打开「审批」下拉,列出其中的动作
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')

await page.evaluate(() => {
  const el = [...document.querySelectorAll('span.tb-main')].find((e) => (e.textContent || '').trim() === '审批')
  if (el) el.click()
})
await page.waitForTimeout(1200)
const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .el-popper li, [class*="dropdown"] li')]
  .filter((el) => el.getBoundingClientRect().width > 0)
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('审批下拉:', JSON.stringify([...new Set(items)]))
