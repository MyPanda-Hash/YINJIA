const task = await taskSpace('material-ret-fix-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/', { timeout: 40000 })
await page.waitForTimeout(3500)

const clickText = async (text) => {
  return await page.evaluate((t) => {
    const nodes = [...document.querySelectorAll('.el-menu-item, .el-sub-menu__title, .el-submenu__title')]
    const hit = nodes.filter((el) => (el.textContent || '').replace(/\s+/g, '').trim() === t.replace(/\s+/g, ''))
    const el = hit[0]
    if (!el) return false
    el.click()
    return true
  }, text)
}

const log = []
log.push(['WMS管理', await clickText('WMS管理')])
await page.waitForTimeout(900)
log.push(['库存核算', await clickText('库存核算')])
await page.waitForTimeout(900)
log.push(['库存明细', await clickText('库存明细')])
await page.waitForTimeout(1500)

const nav = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    items: [...document.querySelectorAll('.el-menu-item')].map(txt).filter(Boolean),
    groups: [...document.querySelectorAll('.el-sub-menu__title, .el-submenu__title')].map(txt).filter(Boolean),
  }
})
console.log(JSON.stringify({ log, nav }, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/material-ret-fix-20261117/round-03-menu.png' })
