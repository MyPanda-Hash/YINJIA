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
await page.evaluate(() => {
  const t = [...document.querySelectorAll('*')].find(e => (e.textContent || '').trim() === '成型配方' && e.children.length === 0 && e.getBoundingClientRect().width > 0)
  t && t.click()
})
await page.waitForTimeout(4000)
const probe = await page.evaluate(() => {
  const sheet = document.querySelector('.rsp-sheet')
  if (!sheet) return { found: false }
  const cs = getComputedStyle(sheet)
  const all = [...sheet.querySelectorAll('*')].map(el => {
    const r = el.getBoundingClientRect()
    return { tag: el.tagName, cls: String(el.className).slice(0, 34), w: Math.round(r.width), right: Math.round(r.right) }
  }).filter(x => x.w > 790).sort((a, b) => b.w - a.w).slice(0, 10)
  return {
    sheetW: Math.round(sheet.getBoundingClientRect().width),
    sheetCss: { width: cs.width, minWidth: cs.minWidth, display: cs.display, tableLayout: cs.tableLayout },
    widest: all,
  }
})
console.log(JSON.stringify(probe, null, 1))
await task.finish({ keep: [] })
process.exit(0)
