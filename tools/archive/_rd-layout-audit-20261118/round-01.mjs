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
const probe = await page.evaluate(() => {
  const out = { pages: [...document.querySelectorAll('.rsp-pages > *')].map(e => (e.innerText || '').trim()).slice(0, 6) }
  const sheet = document.querySelector('[class*="rsp-"], .rs-sheet, .approval-sheet')
  if (sheet) {
    const r = sheet.getBoundingClientRect()
    out.sheet = { cls: sheet.className, w: Math.round(r.width), scrollW: sheet.scrollWidth, clientW: sheet.clientWidth }
    const cs = getComputedStyle(sheet)
    out.sheetStyle = { zoom: cs.zoom, transform: cs.transform, fontSize: cs.fontSize }
  }
  // 所有表格宽度
  const tables = [...document.querySelectorAll('.rsp-sheet table, .rs-t, table')].slice(0, 8).map(t => {
    const r = t.getBoundingClientRect()
    const cg = t.querySelector('colgroup')
    const cols = cg ? [...cg.querySelectorAll('col')].map(c => c.getAttribute('width') || getComputedStyle(c).width).slice(0, 14) : null
    return { cls: t.className, w: Math.round(r.width), cols }
  })
  out.tables = tables
  return out
})
console.log(JSON.stringify(probe, null, 1))
await task.finish({ keep: [] })
process.exit(0)
