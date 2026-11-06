const BASE = 'http://36.140.66.163:8090'
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
await page.waitForTimeout(6800)
try { await page.cdp('Network.clearBrowserCache', {}) } catch (e) {}
await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_INT', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(10000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const st = await page.evaluate(() => ({
  title: [...document.querySelectorAll('.ds-title-part, .ds-title, .ds-title-2')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 3),
  heads: [...document.querySelectorAll('table thead th, .ds-grid-head th')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 15),
  addRow: [...document.querySelectorAll('button, .ds-add-row, [class*="add-row"], [class*="grid-add"]')].map((b) => (b.textContent || '').replace(/\s+/g, '')).filter((t) => /新增样品|新增行/.test(t)).slice(0, 3),
  sideButtons: [...document.querySelectorAll('.as-side-btn')].map((e) => (e.textContent || '').trim()).slice(0, 10),
  hasApproval: [...document.querySelectorAll('button, .as-side-btn')].some((e) => /提交审批|审批通过|审批驳回/.test(e.textContent || '')),
  isTablePanel: !!document.querySelector('.arch-pager, .col-hdr'),
}))
console.log('生产内部单 =', JSON.stringify(st, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-sample-int-paper.png' })
console.log('shot =', shot)
