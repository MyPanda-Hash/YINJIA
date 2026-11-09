// round-12: 在 toast 最亮的时刻取帧(实测它在 ~0.5s 已进入离场,故 120/220ms 各取一张)
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(7000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await page.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(250)
    await page.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { left: 40, top: 10, width: 1500, height: 940 } })
    await page.waitForTimeout(700)
  }
} catch (e) { console.log('restore skip: ' + e.message) }

await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '转ERP')
  if (main) main.click()
})
for (const [i, delay] of [[1, 120], [2, 220]]) {
  await page.waitForTimeout(delay)
  const box = await page.evaluate(() => {
    const el = document.querySelector('.el-message')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { opacity: getComputedStyle(el).opacity, y: r.y, text: (el.textContent || '').trim().slice(0, 20) }
  })
  const shot = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const p = `C:/Users/Lenovo/ego/erp-already-prompt-20261109/after-warning-${i}.png`
  await fs.writeFile(p, Buffer.from(shot.data, 'base64'))
  console.log(`shot${i}=${p} box=` + JSON.stringify(box))
}
