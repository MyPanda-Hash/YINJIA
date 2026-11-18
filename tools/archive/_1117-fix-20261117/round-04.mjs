const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(5000)
const lg = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json(); if (j.code !== 200) return { err: j.message }
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user))
  localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
  return { ok: true }
})
console.log('login:', JSON.stringify(lg))
await page.reload(); await page.waitForTimeout(9000)
for (const [panel, label] of [['RD_APPROVAL', '立项申请表'], ['RD_PLAN', '项目实施计划']]) {
  await page.evaluate((p) => { location.hash = '#/panelx/list/' + p }, panel)
  await page.waitForTimeout(10000)
  const info = await page.evaluate(() => {
    const docno = document.querySelector('.as-docno, .as-docno-static')
    const rows = [...document.querySelectorAll('.as-info-row')].map(r => (r.innerText || '').replace(/\s+/g, ' ').trim())
    return {
      docnoText: docno ? (docno.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) : null,
      infoRows: rows.slice(0, 5),
    }
  })
  console.log(`${label}(${panel}):`, JSON.stringify(info, null, 1))
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_1117-fix-20261117/approval-header.png' })
await task.finish({ keep: [] })
process.exit(0)
