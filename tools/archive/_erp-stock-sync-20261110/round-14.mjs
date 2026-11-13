// round-14:精确定位「查询」弹窗自己的关闭按钮 → 关掉 → 点「审批」→ 截图
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/stock-sync-kingdee-20261110'

const dlgInfo = await page.evaluate(() => {
  const dlgs = [...document.querySelectorAll('.el-dialog, .el-message-box')].filter((el) => el.getBoundingClientRect().width > 0)
  return {
    dlgs: dlgs.map((d) => ({
      title: (d.querySelector('.el-dialog__title, .el-message-box__title') || {}).textContent || '',
      hasHeaderBtn: !!d.querySelector('.el-dialog__headerbtn'),
      footerButtons: [...d.querySelectorAll('.el-dialog__footer button, .el-message-box__btns button')].map((b) => (b.textContent || '').trim()),
    })),
  }
})
console.log('弹窗明细:', JSON.stringify(dlgInfo))

// 关闭所有可见弹窗:优先点 headerbtn,其次点 取消/关闭 按钮
await page.evaluate(() => {
  const dlgs = [...document.querySelectorAll('.el-dialog, .el-message-box')].filter((el) => el.getBoundingClientRect().width > 0)
  for (const d of dlgs) {
    const hb = d.querySelector('.el-dialog__headerbtn')
    if (hb) { hb.click(); continue }
    const cancel = [...d.querySelectorAll('button')].find((b) => ['取消', '关闭'].includes((b.textContent || '').trim()))
    if (cancel) cancel.click()
  }
})
await page.waitForTimeout(1500)

const left = await page.evaluate(() => [...document.querySelectorAll('.el-dialog, .el-message-box')]
  .filter((el) => el.getBoundingClientRect().width > 0).length)
console.log('剩下可见弹窗:', left)

if (left === 0) {
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
    await page.screenshot({ path: `${OUT}/round-14-approve-menu.png` })
    const vis = await page.evaluate(() => {
      const out = []
      for (const el of document.querySelectorAll('*')) {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (['审核', '提交审批', '审批通过'].includes(t) && el.children.length === 0 && el.getBoundingClientRect().width > 0) {
          const r = el.getBoundingClientRect()
          out.push({ t, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) })
        }
      }
      return out
    })
    console.log('可见审批动作:', JSON.stringify(vis))
  }
}
