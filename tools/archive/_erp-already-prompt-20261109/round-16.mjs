// round-16: 8090 固定延时取证(150/300/450ms 各一张,取能看到 toast 的那张)
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
try {
  await page.cdp('Network.enable', {})
  await page.cdp('Network.setCacheDisabled', { cacheDisabled: true })
} catch {}
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

// 一次性把点击+三张截图串在一个 evaluate 里不现实,改为:先点,再连拍三张(每张只留最后一个 el-message 的状态)
await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '转ERP')
  if (main) main.click()
})
const delays = [150, 300, 450]
for (const d of delays) {
  await page.waitForTimeout(d === delays[0] ? d : 150)
  const st = await page.evaluate(() => {
    const el = document.querySelector('.el-message')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { op: getComputedStyle(el).opacity, y: Math.round(r.y), h: Math.round(r.height), txt: (el.textContent || '').slice(0, 12) }
  })
  const shot = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const p = `C:/Users/Lenovo/ego/erp-already-prompt-20261109/shot8090-${d}.png`
  await fs.writeFile(p, Buffer.from(shot.data, 'base64'))
  console.log(`d=${d} state=` + JSON.stringify(st))
}
