const BASE = 'http://127.0.0.1:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/logout', { timeout: 30000 }).catch(() => {})
await page.evaluate(() => { try { localStorage.removeItem('mes_token'); localStorage.removeItem('mes_user') } catch (e) {} })
await page.goto(BASE + '/#/login', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(3500)
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号')); const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'sampler'); if (p) setVal(p, '123456')
})
await page.waitForTimeout(400)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
await page.waitForTimeout(7000)
try { await page.cdp('Network.clearBrowserCache', {}) } catch (e) {}
await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_INT?focus=SPN-2026-11-0005', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(10000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const st = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tbody tr')]
  const out = rows.slice(0, 2).map((tr) => [...tr.querySelectorAll('td')].slice(0, 3).map((td) => {
    const ta = td.querySelector('textarea'); const sp = td.querySelector('.sg-ro')
    return ta ? ('IN:' + (ta.value || '').slice(0, 10)) : (sp ? ('RO:' + (sp.textContent || '').slice(0, 10)) : 'EMPTY')
  }))
  return { rows: rows.length, sample: out, pager: (document.querySelector('.sg-pager') || {}).textContent || '', user: (document.querySelector('.hd-user, .user-name') || {}).textContent || '' }
})
console.log('sampler 视图 =', JSON.stringify(st, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/sample-int-owner-lock.png' })
console.log('shot =', shot)
