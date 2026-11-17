const task = await taskSpace('print-mix-slip-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK_CREATE', { timeout: 30000 })
await page.waitForTimeout(4000)

// 扫一张未开单的工单(0@工单号@1000+行号) → 点「添加」入队 → 点「生成」出两张单并自动打印
await page.fill('input[placeholder*="扫工单码"]', '0@GD-2026-11-0008@1001')
await page.waitForTimeout(800)
const added = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
  if (!b) return false
  b.click(); return true
})
await page.waitForTimeout(1500)
const gen = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '生成')
  if (!b) return false
  b.click(); return true
})
await page.waitForTimeout(9000)
const out = await page.evaluate(() => ({
  addedOk: true,
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 900),
}))
out.added = added
out.gen = gen
console.log(JSON.stringify(out, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/print-mix-slip-20261117/after-generate.png' })
