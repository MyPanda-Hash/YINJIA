// round-13:先把「未保存提示」和「查询」两个弹窗关掉,再点工具栏「审批」→ 截图
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/stock-sync-kingdee-20261110'

// 1) 未保存提示:点「不保存」
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.el-message-box__btns button, .el-dialog__footer button, button')]
  const b = btns.find((x) => (x.textContent || '').trim() === '不保存')
  if (b) b.click()
})
await page.waitForTimeout(1200)

// 2) 关掉「查询」弹窗(找可见的 close 图标)
await page.evaluate(() => {
  const closers = [...document.querySelectorAll('.el-dialog__headerbtn, .el-dialog__header .el-icon-close')]
    .filter((el) => el.getBoundingClientRect().width > 0)
  for (const c of closers) c.click()
})
await page.waitForTimeout(1200)

const state = await page.evaluate(() => ({
  openDialogs: [...document.querySelectorAll('.el-dialog, .el-message-box')].filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => (el.querySelector('.el-dialog__title, .el-message-box__title') || {}).textContent || '(无标题)'),
  toolbar: [...document.querySelectorAll('span.tb-main')].map((el) => (el.textContent || '').trim()),
}))
console.log('弹窗状态:', JSON.stringify(state))

// 3) 真实鼠标点「审批」
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
  await page.screenshot({ path: `${OUT}/round-13-approve-menu.png` })
  const vis = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) continue
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (['审核', '提交审批', '审批通过'].includes(t) && el.children.length === 0) out.push({ t, cls: String(el.className).slice(0, 30) })
    }
    return out
  })
  console.log('可见审批动作:', JSON.stringify(vis))
}
