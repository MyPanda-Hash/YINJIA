const task = await taskSpace('print-mix-slip-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK_CREATE', { timeout: 30000 })
await page.waitForTimeout(4000)

// 输入裸工单号(扫码枪/手输)→ 添加 → 生成;预期出「组装+混料」两张单并各自自动打印
await page.fill('input[placeholder*="扫工单码"]', 'GD-2026-11-0008')
await page.waitForTimeout(600)
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
await page.waitForTimeout(12000)
const out = await page.evaluate(() => ({
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 800),
}))
out.added = added
out.gen = gen
console.log(JSON.stringify(out, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/print-mix-slip-20261117/round-02.png' })
