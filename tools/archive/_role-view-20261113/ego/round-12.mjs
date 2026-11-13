// round-12.mjs —— 真实鼠标点用户名 → 界面设置 → 字段视图切「系统整体」
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

await page.click('css=.show-name')
await page.waitForTimeout(1000)
let menu = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .ctx-item')]
  .filter((e) => e.offsetParent !== null).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('菜单1 = ' + JSON.stringify(menu))

if (!menu.includes('界面设置')) {
  // 退回:点头像/图标
  await page.evaluate(() => {
    const icons = [...document.querySelectorAll('.el-icon.action-icon, [class*=avatar]')]
    if (icons.length) icons[icons.length - 1].click()
  })
  await page.waitForTimeout(1000)
  menu = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .ctx-item')]
    .filter((e) => e.offsetParent !== null).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
  console.log('菜单2 = ' + JSON.stringify(menu))
}

const hit = await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-dropdown-menu__item, .ctx-item')]
    .filter((e) => e.offsetParent !== null).find((e) => (e.textContent || '').trim() === '界面设置')
  if (it) it.click()
  return !!it
})
console.log('点界面设置 = ' + hit)
await page.waitForTimeout(1500)

const dlg = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('字段视图'))
  if (!box) return null
  return {
    title: (box.querySelector('.el-dialog__title')?.textContent || '').trim(),
    labels: [...box.querySelectorAll('.set-label')].map((e) => (e.textContent || '').trim()),
    scopes: [...box.querySelectorAll('.el-radio-button')]
      .filter((e) => ['本角色定制', '系统整体'].includes((e.textContent || '').trim()))
      .map((e) => ({ t: (e.textContent || '').trim(), on: e.className.includes('is-active') })),
    hints: [...box.querySelectorAll('.set-hint')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log('界面设置 = ' + JSON.stringify(dlg, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-12-ui-settings.png' })

const switched = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('字段视图'))
  const btn = [...(box?.querySelectorAll('.el-radio-button') || [])].find((e) => (e.textContent || '').trim() === '系统整体')
  if (btn) btn.click()
  return !!btn
})
console.log('切系统整体 = ' + switched)
await page.waitForTimeout(4500)

const after = await page.evaluate(() => ({
  scope: localStorage.getItem('mes_field_scope'),
  gridHeaders: [...document.querySelectorAll('.el-table__header th')].map((t) => (t.textContent || '').replace(/[⇅\s]/g, '')).filter(Boolean),
}))
console.log(JSON.stringify(after, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-12-system-view.png' })
