const BASE = 'http://127.0.0.1:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/login', { timeout: 60000 })
await page.waitForTimeout(3000)
// 用 sampler(普通用户,无改他人行权限)登录
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号')); const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'sampler'); if (p) setVal(p, '123456')
})
await page.waitForTimeout(400)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
await page.waitForTimeout(6500)
try { await page.cdp('Network.clearBrowserCache', {}) } catch (e) {}
await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_INT?focus=SPN-2026-11-0004', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(10000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const st = await page.evaluate(() => {
  const tas = [...document.querySelectorAll('table textarea')]
  const firstRowInputs = tas.slice(0, 14).map((t) => ({ v: (t.value || '').slice(0, 12), disabled: t.disabled || t.readOnly }))
  return {
    hash: location.hash,
    pager: (document.querySelector('.sg-pager') || {}).textContent ? document.querySelector('.sg-pager').textContent.replace(/\s+/g, ' ').trim() : '',
    visibleRows: document.querySelectorAll('table tbody tr').length,
    addRow: [...document.querySelectorAll('.sg-addrow')].map((e) => (e.textContent || '').trim()),
    applicantCells: firstRowInputs,
  }
})
console.log('sampler 视角 =', JSON.stringify(st, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/sample-int-pager.png' })
console.log('shot =', shot)
