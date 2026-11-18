// round-03:逐页截主内容区文本 + 错误 toast + 截图
const task = await taskSpace('local-migrate-20261117')
const page = task.page('p1')

const routes = [
  ['sale-in', '销售退货单', '/panelx/list/SALE_IN'],
  ['material-ret', '生产退料单', '/panelx/list/MATERIAL_RET'],
  ['prod-pick-list', '生产领料明细表', '/panelx/list/PROD_PICK_LIST'],
  ['prod-ret-list', '生产退料明细表', '/panelx/list/PROD_RET_LIST'],
  ['mobile-return', '手机生产退料', '/panelx/list/MOBILE_RETURN'],
  ['mix-scan', '扫码混料', '/panelx/list/MOBILE_MIX_SCAN'],
]
const out = []
for (const [slug, name, path] of routes) {
  await page.goto('http://localhost:5173/#' + path, { timeout: 60000 })
  await page.waitForTimeout(5500)
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { /* ignore */ }
  const st = await page.evaluate(() => {
    const main = document.querySelector('.panelx-list, .module-view, .sys-page, .portal-content .page, .portal-main')
    const mtxt = (main?.innerText || '').replace(/\s+/g, ' ').slice(0, 260)
    const toasts = [...document.querySelectorAll('.el-message, .el-notification')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim())
    return {
      hash: location.hash,
      mainRows: main ? main.querySelectorAll('.el-table__body tr').length : -1,
      mainText: mtxt,
      toasts,
    }
  })
  await page.screenshot({ path: `C:/Users/vigna/ego/local-migrate-20261117/${slug}.png` })
  out.push({ name, path, ...st })
}
console.log(JSON.stringify(out, null, 2))
