// 2026-11-11 工序按量流转:第 1 轮 —— 打开工序报工页,确认登录态与页面结构
const task = await taskSpace('wo-qty-flow-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_REPORT', { timeout: 30000 })
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const info = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  hasLogin: !!document.querySelector('input[placeholder*="密"]'),
  inputs: [...document.querySelectorAll('input')].map((i) => i.placeholder || i.type).slice(0, 12),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 14),
  bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-01.png' })
