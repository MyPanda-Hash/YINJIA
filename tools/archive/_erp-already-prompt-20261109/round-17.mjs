// round-17: 英语界面回归 —— 把语言切到 en,已转单据点转ERP,提示必须是英文
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
try {
  await page.cdp('Network.enable', {})
  await page.cdp('Network.setCacheDisabled', { cacheDisabled: true })
} catch {}
await page.goto('http://127.0.0.1:8090/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(6000)
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.goto('http://127.0.0.1:8090/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
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

console.log('toolbar=' + JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('span.tb-main')].map((s) => (s.textContent || '').trim()).slice(0, 12))))
console.log('docLine=' + JSON.stringify(await page.evaluate(() => (document.body.innerText.match(/单据[:：]\s*(CGRK-[0-9-]+)/) || [])[1] || (document.body.innerText.match(/Doc(?:ument)?[:：]?\s*(CGRK-[0-9-]+)/) || [])[1])))

await page.evaluate(() => {
  window.__toasts = []
  const seen = new Set()
  setInterval(() => {
    for (const el of document.querySelectorAll('.el-message')) {
      const t = (el.textContent || '').trim(); const cls = String(el.className || '')
      if (t && !seen.has(t + cls)) { seen.add(t + cls); window.__toasts.push({ text: t, cls }) }
    }
  }, 60)
})
const clicked = await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => /ERP/i.test(s.textContent || '') && !/batch/i.test(s.textContent || ''))
  if (!main) return 'none'
  main.click(); return (main.textContent || '').trim()
})
console.log('clicked=' + clicked)
for (const d of [300, 200]) {
  await page.waitForTimeout(d)
  try {
    const shot = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await fs.writeFile('C:/Users/Lenovo/ego/erp-already-prompt-20261109/after-warning-en.png', Buffer.from(shot.data, 'base64'))
  } catch (e) { console.log('shot skip: ' + e.message) }
}
await page.waitForTimeout(800)
console.log('TOASTS=' + JSON.stringify(await page.evaluate(() => window.__toasts.filter((t) => !t.cls.includes('leave')).map((t) => t.text))))
// 复位成中文,别把用户的浏览器语言留在英文
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
