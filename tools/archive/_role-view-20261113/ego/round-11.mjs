// round-11.mjs —— 找右上角用户菜单的触发器
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

const info = await page.evaluate(() => {
  const name = [...document.querySelectorAll('.show-name')][0]
  const chain = []
  let el = name
  for (let i = 0; i < 5 && el; i++) {
    chain.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), role: el.getAttribute('role') })
    el = el.parentElement
  }
  return {
    chain,
    dropdowns: [...document.querySelectorAll('.el-dropdown, .el-tooltip__trigger, [class*=avatar]')]
      .map((e) => ({ tag: e.tagName, cls: (e.className || '').toString().slice(0, 60), txt: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) })),
  }
})
console.log(JSON.stringify(info, null, 1))

// 试:点 .show-name 的祖父级(通常是 dropdown 触发器容器)
const r = await page.evaluate(() => {
  const name = document.querySelector('.show-name')
  const target = name?.parentElement?.parentElement
  if (target) target.click()
  return !!target
})
console.log('点祖父级 = ' + r)
await page.waitForTimeout(900)

const menu = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .ctx-item')]
  .filter((e) => e.offsetParent !== null)
  .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('菜单 = ' + JSON.stringify(menu))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-11-user-menu.png' })
