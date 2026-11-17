const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(4000)
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
await page.goto('http://36.140.66.163:8090/#/panelx/list/QC_LINE_PATROL')
await page.reload()
await page.waitForTimeout(12000)
const info = await page.evaluate(() => {
  const board = document.querySelector('.lp-title, .as-title, .qc-title') || document.body
  return {
    url: location.hash,
    title: (document.querySelector('.as-title')?.innerText || '').trim(),
    headers: [...document.querySelectorAll('th')].map(t => (t.innerText||'').replace(/\s+/g,'')).filter(Boolean).slice(0, 12),
    hasLiangYe: document.body.innerText.includes('两液密度'),
    hasLiangDuan: document.body.innerText.includes('两端密度'),
  }
})
console.log(JSON.stringify(info, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_deploy-20261117/prod-line-patrol.png' })
await task.finish({ keep: [] })
process.exit(0)
