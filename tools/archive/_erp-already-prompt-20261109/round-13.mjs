// round-13: 8090(打包版 jar)回归 —— 已转单据点「转ERP」应弹黄色警告,且接口回 already=true
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(9000)
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
  window.__erpReqs = []
  window.__toasts = []
  const open = XMLHttpRequest.prototype.open
  const send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__m = m; this.__u = u; return open.call(this, m, u, ...rest) }
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      if (String(this.__u || '').includes('callButton')) {
        window.__erpReqs.push((() => { try { return JSON.parse(this.responseText) } catch { return null } })())
      }
    })
    return send.apply(this, args)
  }
  const seen = new Set()
  window.__poll = setInterval(() => {
    for (const el of document.querySelectorAll('.el-message')) {
      const t = (el.textContent || '').trim(); const cls = String(el.className || '')
      if (t && !seen.has(t + cls)) { seen.add(t + cls); window.__toasts.push({ text: t, cls }) }
    }
  }, 80)
})
const docNo = await page.evaluate(() => (document.body.innerText.match(/单据：(CGRK-[0-9-]+)/) || [])[1])
console.log('doc=' + docNo + ' loginPage=' + await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]')))
await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '转ERP')
  if (main) main.click()
})
await page.waitForTimeout(1200)
const shot = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
await fs.writeFile('C:/Users/Lenovo/ego/erp-already-prompt-20261109/after-warning-8090.png', Buffer.from(shot.data, 'base64'))
await page.waitForTimeout(1500)
console.log('RESP=' + JSON.stringify((await page.evaluate(() => window.__erpReqs))[0] || null))
console.log('TOASTS=' + JSON.stringify(await page.evaluate(() => window.__toasts), null, 2))
