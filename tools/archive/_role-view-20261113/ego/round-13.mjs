// round-13.mjs —— 切回「本角色定制」,验证列又被藏起来(同一账号,两次切换即时生效)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

// 界面设置可能还开着;没开就重新打开
let open = await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].some((d) => d.offsetParent !== null && (d.textContent || '').includes('字段视图')))
if (!open) {
  await page.evaluate(() => {
    const icons = [...document.querySelectorAll('.el-icon.action-icon, [class*=avatar]')]
    if (icons.length) icons[icons.length - 1].click()
  })
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const it = [...document.querySelectorAll('.el-dropdown-menu__item, .ctx-item')]
      .filter((e) => e.offsetParent !== null).find((e) => (e.textContent || '').trim() === '界面设置')
    if (it) it.click()
  })
  await page.waitForTimeout(1200)
}

const switched = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('字段视图'))
  const btn = [...(box?.querySelectorAll('.el-radio-button') || [])].find((e) => (e.textContent || '').trim() === '本角色定制')
  if (btn) btn.click()
  return !!btn
})
console.log('切回本角色定制 = ' + switched)
await page.waitForTimeout(4000)

const after = await page.evaluate(() => ({
  scope: localStorage.getItem('mes_field_scope'),
  gridHeaders: [...document.querySelectorAll('.el-table__header th')].map((t) => (t.textContent || '').replace(/[⇅\s]/g, '')).filter(Boolean),
}))
console.log(JSON.stringify(after, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-13-role-view.png' })

// 关掉界面设置
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('字段视图'))
  box?.querySelector('.el-dialog__headerbtn')?.click()
})
await page.waitForTimeout(600)
