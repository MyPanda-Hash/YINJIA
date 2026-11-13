// round-07.mjs —— 用「更多」右边的 ▼ 打开下拉(点 tb-main 会直接执行主动作「复制」,别碰)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

const r = await page.evaluate(() => {
  const more = [...document.querySelectorAll('.tb-main .act-name')].find((s) => (s.textContent || '').trim() === '更多')
  if (!more) return { ok: false }
  const group = more.closest('.tb-group')
  const caret = group?.querySelector('.tb-caret')
  if (caret) caret.click()
  return { ok: !!caret }
})
console.log('打开下拉 = ' + JSON.stringify(r))
await page.waitForTimeout(900)

const menu = await page.evaluate(() => {
  const box = [...document.querySelectorAll('[class*="dropdown"], [class*="popover"], [class*="menu"]')]
    .filter((e) => e.offsetParent !== null)
  const items = []
  for (const b of box) {
    for (const li of b.querySelectorAll('li, .el-dropdown-menu__item, [class*="item"]')) {
      const t = (li.textContent || '').replace(/\s+/g, ' ').trim()
      if (t && t.length <= 12 && li.offsetParent !== null) items.push({ t, c: li.className })
    }
  }
  const seen = new Set()
  return items.filter((x) => (seen.has(x.t) ? false : (seen.add(x.t), true)))
})
console.log('下拉项 = ' + JSON.stringify(menu, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-07-more-open.png' })
