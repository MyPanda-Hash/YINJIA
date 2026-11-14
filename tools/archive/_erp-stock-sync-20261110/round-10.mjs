// round-10:用真实鼠标点开「审批」下拉(定位到 span.tb-main 的中心坐标)
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')

const pos = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span.tb-main')].find((e) => (e.textContent || '').trim() === '审批')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('审批按钮坐标:', JSON.stringify(pos))
if (pos) {
  await page.mouse.click(pos.x, pos.y, { label: '打开审批下拉' })
  await page.waitForTimeout(1500)
  const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .el-popover li, .el-popper li, .tb-menu-item, .tb-item')]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => ({ t: (el.textContent || '').replace(/\s+/g, ' ').trim(), cls: String(el.className).slice(0, 40) })))
  console.log('下拉项:', JSON.stringify([...new Map(items.map((i) => [i.t, i])).values()]).slice(0, 800))
}
