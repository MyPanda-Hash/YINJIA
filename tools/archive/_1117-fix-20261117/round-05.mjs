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
await page.evaluate(() => { location.hash = '#/panelx/list/RD_PROD_INFO' })
await page.waitForTimeout(11000)
const info = await page.evaluate(() => {
  const body = document.body.innerText
  const libs = [...document.querySelectorAll('.rs-lib-btn')].map(e => (e.innerText || '').trim())
  const rows = [...document.querySelectorAll('.rs-t tbody tr')].length
  const hasScene = body.includes('应用场景')
  // 找 应用场景 那一格附近有没有下拉/标准库按钮
  const labels = [...document.querySelectorAll('td, .rs-label, span')]
    .filter(e => (e.innerText || '').trim() === '应用场景')
  return { hasScene, libBtnCount: libs.length, libTexts: [...new Set(libs)].slice(0, 3), sceneCells: labels.length, tableRows: rows }
})
console.log('产品信息表:', JSON.stringify(info))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_1117-fix-20261117/prodinfo.png' })
await task.finish({ keep: [] })
process.exit(0)
