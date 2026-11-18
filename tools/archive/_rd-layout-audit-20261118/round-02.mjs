const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(5000)
await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json()
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user))
  localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
})
await page.reload(); await page.waitForTimeout(9000)
await page.evaluate(() => { location.hash = '#/panelx/list/RD_MOLD_PROC' })
await page.waitForTimeout(12000)
// 点「成型配方」页签
const clicked = await page.evaluate(() => {
  const t = [...document.querySelectorAll('*')].find(e => (e.textContent || '').trim() === '成型配方' && e.children.length === 0 && e.getBoundingClientRect().width > 0)
  if (t) { t.click(); return true }
  return false
})
console.log('点成型配方页签:', clicked)
await page.waitForTimeout(4000)
const probe = await page.evaluate(() => {
  const out = {}
  const sheet = document.querySelector('.rsp-sheet, [class*="rsp-sheet"], .approval-sheet')
  if (sheet) {
    const r = sheet.getBoundingClientRect()
    const cs = getComputedStyle(sheet)
    out.sheet = { w: Math.round(r.width), scrollW: sheet.scrollWidth, clientW: sheet.clientWidth,
                  zoom: cs.zoom, transform: cs.transform }
  }
  const visibleTables = [...document.querySelectorAll('table.rs-t')].filter(t => t.getBoundingClientRect().width > 0)
  out.tables = visibleTables.map(t => {
    const r = t.getBoundingClientRect()
    const cg = t.querySelector('colgroup')
    const cols = cg ? [...cg.querySelectorAll('col')].map(c => getComputedStyle(c).width) : null
    return { cls: t.className, w: Math.round(r.width), sumCols: cols ? cols.reduce((a, c) => a + (parseFloat(c) || 0), 0) : null, ncols: cols ? cols.length : null }
  })
  // 章节/表区容器
  const bands = [...document.querySelectorAll('.rsp-bar, .rs-bar, .rsp-sec, .rs-sec')].slice(0, 6).map(e => {
    const r = e.getBoundingClientRect(); return { cls: e.className, w: Math.round(r.width), text: (e.innerText || '').trim().slice(0, 12) }
  })
  out.bands = bands
  return out
})
console.log(JSON.stringify(probe, null, 1))
await task.finish({ keep: [] })
process.exit(0)
