const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
async function loginAs(u, p) {
  return page.evaluate(async ([u, p]) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p, factory: 'YJ' }) })
    const j = await r.json()
    if (j.code !== 200) return { err: j.message }
    localStorage.setItem('mes_token', j.data.token)
    localStorage.setItem('mes_user', JSON.stringify(j.data.user))
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
    return { ok: true }
  }, [u, p])
}
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(4000)
console.log('login:', JSON.stringify(await loginAs('admin', '123456')))

// ① 打开项目实施计划，验证「申请终止」按钮是否出现（LXB-2026-11-0005）
await page.goto('http://36.140.66.163:8090/#/panelx/list/RD_PLAN')
await page.reload()
await page.waitForTimeout(12000)
const rail = await page.evaluate(() => {
  const txt = document.body.innerText
  const items = [...document.querySelectorAll('.dsr-item, .dsr-row, [class*="dsr"] [class*="item"]')]
    .map(e => (e.innerText||'').replace(/\s+/g,' ').trim()).filter(t => t.includes('LXB-')).slice(0,5)
  return { items, hasTerm: txt.includes('申请终止'), hasComplete: txt.includes('完成') }
})
console.log('打开计划页:', JSON.stringify(rail))

// ② 切到 LXB-2026-11-0005
const jumped = await page.evaluate(() => {
  const row = [...document.querySelectorAll('*')].find(e => (e.innerText||'').trim().startsWith('LXB-2026-11-0005') && e.children.length <= 3)
  if (!row) return { found: false }
  row.click(); return { found: true }
})
console.log('点单据:', JSON.stringify(jumped))
await page.waitForTimeout(5000)
const after = await page.evaluate(() => {
  const txt = document.body.innerText
  return {
    hash: location.hash,
    hasTermRequest: txt.includes('申请终止'),
    footers: document.querySelectorAll('.as-phase-footer').length,
    termBanner: document.querySelectorAll('.as-term-banner').length,
    phase0filled: document.querySelectorAll('.as-phase[data-filled="1"]').length,
  }
})
console.log('LXB-0005 详情:', JSON.stringify(after))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_plan-term-check-20261117/after-fix-0005.png' })
await task.finish({ keep: [] })
process.exit(0)
