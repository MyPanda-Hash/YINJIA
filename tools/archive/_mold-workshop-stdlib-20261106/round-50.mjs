const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/login', { timeout: 60000 })
await page.waitForTimeout(3300)
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号')); const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
})
await page.waitForTimeout(400)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
await page.waitForTimeout(6800)
try { await page.cdp('Network.clearBrowserCache', {}) } catch (e) {}
await page.goto(BASE + '/#/panelx/list/RD_MOLD_PROC', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const st = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td')]
  const i = tds.findIndex((td) => (td.textContent || '').replace(/\s+/g, ' ').trim() === '生产车间')
  const cell = i >= 0 ? tds[i + 1] : null
  return {
    found: i >= 0,
    cellHtml: cell ? cell.innerHTML.slice(0, 160) : '',
    hasSelect: cell ? !!cell.querySelector('.el-select') : false,
    hasLibBtn: cell ? [...cell.querySelectorAll('span,div')].some((e) => (e.textContent || '').includes('标准库维护')) : false,
    cellText: cell ? (cell.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) : '',
  }
})
console.log('烧结工艺清单 生产车间 =', JSON.stringify(st, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-workshop.png' })
console.log('shot =', shot)
