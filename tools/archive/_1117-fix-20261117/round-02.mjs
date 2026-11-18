const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false })
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
await page.evaluate(() => { location.hash = '#/panelx/list/RD_MOLD_PROC' })
await page.waitForTimeout(9000)
// 读第1页编号
const p1 = await page.evaluate(() => {
  const el = document.querySelector('.rs-docno-static, .rsp-cover-docno-val, .rs-docno')
  const pre = document.querySelector('.rs-docno-prefix')
  return { prefix: pre ? pre.innerText.trim() : '', no: el ? el.innerText.trim() : '' }
})
console.log('烧结页1:', JSON.stringify(p1))
// 切到第2页(配方)
const tabs = await page.evaluate(() => [...document.querySelectorAll('[class*="tab"], .el-tabs__item')].map(e => (e.innerText||'').trim()).filter(t => t && t.length < 20).slice(0, 12))
console.log('页签:', JSON.stringify([...new Set(tabs)]))
const clicked = await page.evaluate(() => {
  const t = [...document.querySelectorAll('*')].find(e => (e.innerText||'').trim() === '成型配方' && e.getBoundingClientRect().width > 0 && e.children.length === 0)
  if (t) { t.click(); return true }
  return false
})
await page.waitForTimeout(4000)
const p2 = await page.evaluate(() => {
  const el = document.querySelector('.rs-docno-static, .rsp-cover-docno-val, .rs-docno')
  const pre = document.querySelector('.rs-docno-prefix')
  return { clicked: true, prefix: pre ? pre.innerText.trim() : '', no: el ? el.innerText.trim() : '' }
})
console.log('点成型配方:', clicked, '| 页2编号:', JSON.stringify(p2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_1117-fix-20261117/formula-page.png' })
await task.finish({ keep: [] })
process.exit(0)
