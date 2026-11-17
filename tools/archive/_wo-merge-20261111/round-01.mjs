// 订单结转转工单·同订单一张工单(2026-11-11)验证 round-01:登录 YJ_TEST 并打开订单结转页
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
console.log('space', task.spaceId, 'page', page.label)
await page.goto('http://localhost:5173/', { timeout: 30000 })
await page.waitForTimeout(3500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
const info = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, val: i.value, type: i.type })),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  selects: [...document.querySelectorAll('.el-select')].map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-01-login.png' })
