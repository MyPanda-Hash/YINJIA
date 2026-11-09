// round-14: 8090 复验(禁缓存) —— 确认打包版前端也弹"已转过"警告
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
try {
  await page.cdp('Network.enable', {})
  await page.cdp('Network.setCacheDisabled', { cacheDisabled: true })
  console.log('cache=disabled')
} catch (e) { console.log('cache skip: ' + e.message) }
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await page.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(250)
    await page.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { left: 40, top: 10, width: 1500, height: 940 } })
    await page.waitForTimeout(600)
  }
} catch (e) { console.log('restore skip: ' + e.message) }

console.log('entry=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')).slice(0, 3))))
await page.evaluate(() => {
  window.__toasts = []
  const seen = new Set()
  window.__poll = setInterval(() => {
    for (const el of document.querySelectorAll('.el-message')) {
      const t = (el.textContent || '').trim(); const cls = String(el.className || '')
      if (t && !seen.has(t + cls)) { seen.add(t + cls); window.__toasts.push({ text: t, cls }) }
    }
  }, 80)
})
const docNo = await page.evaluate(() => (document.body.innerText.match(/单据：(CGRK-[0-9-]+)/) || [])[1])
console.log('doc=' + docNo)
await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '转ERP')
  if (main) main.click()
})
await page.waitForTimeout(900)
try {
  const shot = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await fs.writeFile('C:/Users/Lenovo/ego/erp-already-prompt-20261109/after-warning-8090.png', Buffer.from(shot.data, 'base64'))
  console.log('shot=ok')
} catch (e) { console.log('shot skip: ' + e.message) }
await page.waitForTimeout(1200)
console.log('TOASTS=' + JSON.stringify(await page.evaluate(() => window.__toasts.filter((t) => !t.cls.includes('leave')).map((t) => t.text)), null, 2))
