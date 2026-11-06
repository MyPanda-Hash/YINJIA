const BASE = 'http://127.0.0.1:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/login', { timeout: 60000 })
await page.waitForTimeout(3200)
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号')); const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
})
await page.waitForTimeout(400)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
await page.waitForTimeout(6000)
try { await page.cdp('Network.clearBrowserCache', {}) } catch (e) {}
await page.goto(BASE + '/#/panelx/list/RD_PROD_INFO', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const st = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td')]
  const labels = tds.map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const i = labels.findIndex((x) => x === '客户名称')
  return {
    hash: location.hash,
    aroundCustomer: labels.slice(Math.max(0, i - 6), i + 10),
    hasCode: labels.includes('客户编码'),
    refCells: [...document.querySelectorAll('.rs-ref-ctl')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 12),
  }
})
console.log(JSON.stringify(st, null, 2))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prodinfo-custcode.png' })
console.log('shot =', shot)
