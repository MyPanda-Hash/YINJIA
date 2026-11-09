// round-15: 8090 取证截图 —— 等到 toast 可见(opacity=1)的那一帧再抓
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

const clicked = await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '转ERP')
  if (!main) return false
  main.click(); return true
})
console.log('clicked=' + clicked)
let ok = false
for (let i = 0; i < 40; i++) {
  const st = await page.evaluate(() => {
    const el = document.querySelector('.el-message')
    if (!el) return null
    return { opacity: getComputedStyle(el).opacity, text: (el.textContent || '').trim() }
  })
  if (st && st.opacity === '1') {
    const shot = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await fs.writeFile('C:/Users/Lenovo/ego/erp-already-prompt-20261109/after-warning-8090.png', Buffer.from(shot.data, 'base64'))
    console.log('shot=ok i=' + i + ' text=' + st.text)
    ok = true
    break
  }
  await page.waitForTimeout(50)
}
if (!ok) console.log('shot=missed (toast never reached opacity 1)')
