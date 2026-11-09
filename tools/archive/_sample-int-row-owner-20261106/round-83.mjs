const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/logout', { timeout: 40000 }).catch(() => {})
await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
await page.goto(BASE + '/#/login', { timeout: 60000 })
await page.reload({ timeout: 60000 })
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
// ① 内部样品单:纸面 + 新增样品按钮
await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_INT', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(10000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const intSt = await page.evaluate(() => ({
  addRow: [...document.querySelectorAll('.sg-addrow')].map((e) => (e.textContent || '').trim()).slice(0, 2),
  pager: (document.querySelector('.sg-pager') || {}).textContent ? document.querySelector('.sg-pager').textContent.replace(/\s+/g, ' ').trim() : '',
  heads: [...document.querySelectorAll('table thead th')].map((e) => (e.textContent || '').trim()).slice(0, 6),
}))
console.log('内部单 =', JSON.stringify(intSt))
const shot1 = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-sample-int-owner.png' })
console.log('shot1 =', shot1)
// ② 组织架构:权限矩阵里应有「改他人行」列
await page.goto(BASE + '/#/sys/org', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(10000)
const orgSt = await page.evaluate(() => ({
  hash: location.hash,
  acts: [...document.querySelectorAll('.perm-table thead th')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 20),
  hasEditOthers: [...document.querySelectorAll('.perm-table thead th')].some((e) => (e.textContent || '').trim() === '改他人行'),
}))
console.log('组织架构矩阵 =', JSON.stringify(orgSt, null, 1))
const shot2 = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-org-editothers.png' })
console.log('shot2 =', shot2)
