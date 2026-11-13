// round-06.mjs —— 点「更多」,看下拉里有没有 表格调整 / 表头调整
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

const clicked = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('.tb-main .act-name')]
  const more = spans.find((s) => (s.textContent || '').trim() === '更多')
  if (!more) return { ok: false, all: spans.map((s) => (s.textContent || '').trim()) }
  more.click()
  const main = more.closest('.tb-main')
  if (main) main.click()
  return { ok: true, all: spans.map((s) => (s.textContent || '').trim()) }
})
console.log('工具栏动作 = ' + JSON.stringify(clicked))
await page.waitForTimeout(900)

const menu = await page.evaluate(() => {
  const sel = '.el-dropdown-menu, .el-dropdown-menu__item, [class*="tb-menu"] li, [class*="tb-menu"] a, [class*="tb-menu"] span'
  const items = [...document.querySelectorAll(sel)]
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ t: (e.textContent || '').replace(/\s+/g, ' ').trim(), c: e.className }))
    .filter((x) => x.t && x.t.length < 20)
  // 去重
  const seen = new Set()
  return items.filter((x) => (seen.has(x.t + x.c) ? false : (seen.add(x.t + x.c), true)))
})
console.log('下拉项 = ' + JSON.stringify(menu, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-06-menu.png' })
