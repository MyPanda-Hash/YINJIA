// round-04:扫码混料 功能性——输入真实工单号,看能否带出物料清单
const task = await taskSpace('local-migrate-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { /* ignore */ }

// 填工单号 + 点查询
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const inp = [...document.querySelectorAll('input')].find((i) => /工单/.test(i.placeholder || ''))
  if (inp) setVal(inp, 'YJ@GD-2026-11-0028@1001')
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询')
  if (btn) btn.click()
})
await page.waitForTimeout(6000)

const st = await page.evaluate(() => {
  const toasts = [...document.querySelectorAll('.el-message, .el-notification')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim())
  const main = document.querySelector('.portal-content') || document.body
  const txt = (main.innerText || '').replace(/\s+/g, ' ')
  return {
    toasts,
    hasOrderInfo: /GD-2026-11-0028/.test(txt),
    hasBomHint: /物料清单|BOM|待取秤|取秤/.test(txt),
    rows: document.querySelectorAll('.el-table__body tr').length,
    text: txt.slice(0, 700),
  }
})
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/local-migrate-20261117/mix-scan-functional2.png' })
