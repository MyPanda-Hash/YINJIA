const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(4500)
const lg = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json()
  if (j.code !== 200) return { err: j.message }
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user))
  localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
  return { ok: true }
})
console.log('login:', JSON.stringify(lg))
await page.goto('http://36.140.66.163:8090/#/panelx/list/RD_PLAN?code=LXB-2026-11-0001')
await page.reload()
await page.waitForTimeout(14000)
const info = await page.evaluate(() => {
  const txt = document.body.innerText
  const btns = [...document.querySelectorAll('button')].map(b => (b.innerText||'').trim()).filter(Boolean)
  return {
    url: location.hash,
    hasTermRequest: txt.includes('申请终止'),
    hasComplete: /(^|\n)完成(\n|$)/.test(txt),
    hasBanner: txt.includes('终止审批'),
    seenButtons: [...new Set(btns)].slice(0, 24),
    phaseFooters: document.querySelectorAll('.as-phase-footer').length,
    bannerCount: document.querySelectorAll('.as-term-banner').length,
  }
})
console.log(JSON.stringify(info, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_plan-term-check-20261117/plan-0001.png' })
await task.finish({ keep: [] })
process.exit(0)
