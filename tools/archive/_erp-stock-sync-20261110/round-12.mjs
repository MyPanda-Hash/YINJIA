// round-12:重新打开采购入库单列表(清掉之前误开的弹窗)→ 用真实鼠标点「审批」→ 截图看下拉
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/stock-sync-kingdee-20261110'

await page.goto('http://127.0.0.1:8090/#/panelx/list/PURCHASE_IN', { timeout: 30000 })
await page.waitForTimeout(7000)

const pos = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span.tb-main')].find((e) => (e.textContent || '').trim() === '审批')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('审批坐标:', JSON.stringify(pos))

if (pos) {
  await page.mouse.click(pos.x, pos.y, { label: '点开审批菜单' })
  await page.waitForTimeout(1500)
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/round-12-approve-menu.png` })
  const menu = await page.evaluate(() => {
    const vis = (el) => el.getBoundingClientRect().width > 0
    const cands = [...document.querySelectorAll('*')].filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
      return vis(el) && ['审核', '提交审批', '审批通过', '驳回审批', '弃审'].includes(t) && el.children.length === 0
    }).map((el) => ({ t: (el.textContent || '').trim(), cls: String(el.className).slice(0, 40) }))
    return { cands }
  })
  console.log('可见动作:', JSON.stringify(menu))
}
