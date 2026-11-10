// round-15:取消弹窗 → 点开「审批」菜单 → 打印菜单项与坐标
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/stock-sync-kingdee-20261110'

// 取消当前「提交审批确认」
await page.evaluate(() => {
  const dlgs = [...document.querySelectorAll('.el-dialog, .el-message-box')].filter((el) => el.getBoundingClientRect().width > 0)
  for (const d of dlgs) {
    const cancel = [...d.querySelectorAll('button')].find((b) => ['取消', '关闭'].includes((b.textContent || '').trim()))
    if (cancel) cancel.click()
  }
})
await page.waitForTimeout(1200)

// 点开审批菜单
await page.mouse.click(599, 125, { label: '点开审批菜单' })
await page.waitForTimeout(1500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/round-15-menu.png` })

const menu = await page.evaluate(() => {
  // 找出「审批」按钮附近出现的浮层容器
  const cands = []
  for (const el of document.querySelectorAll('div,ul')) {
    const r = el.getBoundingClientRect()
    if (r.width < 60 || r.width > 260 || r.height < 30) continue
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
    if (t.length > 60) continue
    if (!/审核|审批/.test(t)) continue
    cands.push({ t, cls: String(el.className).slice(0, 40), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) })
  }
  const items = [...document.querySelectorAll('li,div,span,a')]
    .filter((el) => {
      const r = el.getBoundingClientRect()
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
      return r.width > 0 && ['审核', '提交审批', '审批通过', '驳回审批'].includes(t)
    })
    .map((el) => {
      const r = el.getBoundingClientRect()
      return { t: (el.textContent || '').trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
    })
  return { cands, items }
})
console.log(JSON.stringify(menu).slice(0, 1500))
