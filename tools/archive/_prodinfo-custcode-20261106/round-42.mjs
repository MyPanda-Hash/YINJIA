const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/login', { timeout: 60000 })
await page.waitForTimeout(3500)
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号')); const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
})
await page.waitForTimeout(400)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
await page.waitForTimeout(7000)
try { await page.cdp('Network.clearBrowserCache', {}) } catch (e) {}
await page.goto(BASE + '/#/panelx/list/RD_PROD_INFO', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(10000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const info = await page.evaluate(() => {
  const trs = [...document.querySelectorAll('tr')]
  const rows = []
  for (const tr of trs) {
    const cells = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
    const j = cells.join(' | ')
    if (/项目编号|产品编号|客户编码|产品形态|应用场景|客户料号/.test(j) && j.length < 160) rows.push(j)
  }
  return { hash: location.hash, chunk: (document.querySelector('script[src*="index-"]') || {}).src || '', rows: rows.slice(0, 8) }
})
console.log(JSON.stringify(info, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-8090-prodinfo.png' })
console.log('shot =', shot)
