const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(5000)
const lg = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json()
  if (j.code !== 200) return { err: j.message }
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user))
  localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
  return { ok: true, isAdmin: j.data.user.isAdmin, vp: (j.data.user.visiblePanels||[]).length }
})
console.log('login:', JSON.stringify(lg))
await page.reload()
await page.waitForTimeout(9000)
// 用 hash 导航（不 reload）
await page.evaluate(() => { location.hash = '#/panelx/list/RD_PLAN' })
await page.waitForTimeout(9000)
const s1 = await page.evaluate(() => ({
  hash: location.hash,
  hasTerm: document.body.innerText.includes('申请终止'),
  docCount: (document.body.innerText.match(/LXB-2026-11-/g) || []).length,
  footers: document.querySelectorAll('.as-phase-footer').length,
  filledPhases: [...document.querySelectorAll('.as-phase')].map(e => e.getAttribute('data-filled')).slice(0,5),
}))
console.log('RD_PLAN 页:', JSON.stringify(s1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_plan-term-check-20261117/plan-page.png' })
await task.finish({ keep: [] })
process.exit(0)
