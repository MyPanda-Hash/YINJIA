const task = await taskSpace(17)
const page = task.page('p1')
// 切回正式账套(YJ)
await page.goto('http://127.0.0.1:8090/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(3000)
const opened = await page.evaluate(() => {
  const el = document.querySelector('.factory')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})
if (opened) await page.mouse.click(opened.x + Math.min(40, opened.w / 2), opened.y + opened.h / 2, { label: 'open factory menu' })
await page.waitForTimeout(1000)
const target = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const items = [...document.querySelectorAll('.factory-item')].map((el) => {
    const r = el.getBoundingClientRect()
    return { text: txt(el), x: r.x, y: r.y, w: r.width, h: r.height }
  })
  return items.find((i) => i.text === 'YINJIA-MES') || null
})
console.log('TARGET ' + JSON.stringify(target))
if (target) await page.mouse.click(target.x + target.w / 2, target.y + target.h / 2, { label: 'switch to prod factory' })
await page.waitForTimeout(1500)
const dialog = await page.evaluate(() => {
  const box = document.querySelector('.el-dialog, .el-message-box')
  return box ? (box.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200) : ''
})
console.log('DIALOG ' + dialog)
if (dialog.includes('切换账套')) {
  await page.fill('input[type="password"], input[placeholder*="密码"]', '123456')
  await page.waitForTimeout(300)
  await page.click('button:has-text("切换并重新登录")')
  await page.waitForTimeout(8000)
}
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return { hash: location.hash, factory: txt(document.querySelector('.factory-name')) }
})
console.log(JSON.stringify(state))
// 打开「扫码混料 → GD-2026-09-0135 #1」(正式库只读查看:取数来自混料物料清单)
await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-09-0135&line=1', { timeout: 30000 })
await page.waitForTimeout(4500)
const view = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    factory: txt(document.querySelector('.factory-name')),
    kv: [...document.querySelectorAll('.mp-kv')].map(txt),
    rows: [...document.querySelectorAll('.mp-line')].map(txt),
  }
})
console.log(JSON.stringify(view, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-13-final-prod-mixdoc.png' })
