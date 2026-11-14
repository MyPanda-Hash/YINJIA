// round-11:鼠标点开「审批」后截图 + 打印页面可见短文本(找下拉菜单真实结构)
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/stock-sync-kingdee-20261110'

await page.mouse.click(599, 125, { label: '打开审批下拉' })
await page.waitForTimeout(1500)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/round-11-dropdown.png` })

const info = await page.evaluate(() => {
  const poppers = [...document.querySelectorAll('.el-popper')].map((el) => ({
    cls: String(el.className).slice(0, 60),
    visible: el.getBoundingClientRect().width > 0,
    text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
  }))
  const short = [...document.querySelectorAll('li, .el-dropdown-menu__item, [role="menuitem"]')]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t && t.length <= 12)
  return { poppers, short: [...new Set(short)].slice(0, 20) }
})
console.log(JSON.stringify(info, null, 1).slice(0, 1500))
