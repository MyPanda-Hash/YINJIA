// round-04.mjs —— 找「表格调整 / 表头调整」入口(更多下拉)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

const bar = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const more = btns.find((b) => (b.textContent || '').replace(/\s+/g, '').includes('更多'))
  if (more) more.click()
  return btns.map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
})
console.log('按钮栏 = ' + JSON.stringify(bar))
await page.waitForTimeout(900)

const menu = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, .el-dropdown-menu li')]
  return items.map((i) => (i.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
})
console.log('更多下拉 = ' + JSON.stringify(menu, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-04-more-menu.png' })
