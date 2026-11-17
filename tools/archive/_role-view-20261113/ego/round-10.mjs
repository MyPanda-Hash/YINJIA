// round-10.mjs —— 界面设置里把「字段视图」切成系统整体,看列是否全部回来(并截图)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

// 1) 打开右上角用户菜单 → 界面设置
const opened = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span, div, a')]
    .find((e) => e.children.length === 0 && (e.textContent || '').trim() === '字段视图走查A')
  if (!el) return { ok: false }
  el.click()
  return { ok: true, cls: el.className }
})
console.log('点用户名 = ' + JSON.stringify(opened))
await page.waitForTimeout(800)

const setItem = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, li, .ctx-item')]
    .filter((e) => e.offsetParent !== null && (e.textContent || '').trim() === '界面设置')
  if (items.length) items[0].click()
  return items.length
})
console.log('点界面设置 = ' + setItem)
await page.waitForTimeout(1200)

const before = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('字段视图'))
  if (!box) return null
  return {
    title: (box.querySelector('.el-dialog__title')?.textContent || '').trim(),
    labels: [...box.querySelectorAll('.set-label')].map((e) => (e.textContent || '').trim()),
    scopes: [...box.querySelectorAll('.el-radio-button')].filter((e) => ['本角色定制', '系统整体'].includes((e.textContent || '').trim()))
      .map((e) => ({ t: (e.textContent || '').trim(), on: e.className.includes('is-active') })),
    hints: [...box.querySelectorAll('.set-hint')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log('界面设置 = ' + JSON.stringify(before, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-10-ui-settings.png' })

// 2) 切到「系统整体」
const switched = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('字段视图'))
  const btn = [...(box?.querySelectorAll('.el-radio-button') || [])].find((e) => (e.textContent || '').trim() === '系统整体')
  if (btn) btn.click()
  return !!btn
})
console.log('切系统整体 = ' + switched)
await page.waitForTimeout(4000)

const after = await page.evaluate(() => ({
  scope: localStorage.getItem('mes_field_scope'),
  gridHeaders: [...document.querySelectorAll('.el-table__header th')].map((t) => (t.textContent || '').replace(/[⇅\s]/g, '')).filter(Boolean),
}))
console.log(JSON.stringify(after, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-10-system-view.png' })
