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
  const g = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect()
    return { w: Math.round(r.width), width: cs.width, minWidth: cs.minWidth, maxWidth: cs.maxWidth,
             display: cs.display, tableLayout: cs.tableLayout, boxSizing: cs.boxSizing, whiteSpace: cs.whiteSpace }
  }
  const dt = [...document.querySelectorAll('table.rs-t.rs-dt')].find(x => x.getBoundingClientRect().width > 0)
  const cols = dt ? [...dt.querySelectorAll('colgroup col')].map(c => getComputedStyle(c).width) : []
  const ths = dt ? [...dt.querySelectorAll('thead th, tr.rs-grp th')].map(th => Math.round(th.getBoundingClientRect().width)) : []
  return {
    sheet: g('.rsp-sheet'),
    dtWrap: g('.rsp-dt-wrap'),
    dtTable: g('.rsp-dt-table'),
    dt: g('table.rs-t.rs-dt'),
    sheetInner: g('.rsp-sheet > *'),
    cols, ths,
    sheetChildren: [...document.querySelector('.rsp-sheet').children].map(c => ({ cls: String(c.className).slice(0, 30), w: Math.round(c.getBoundingClientRect().width) })),
  }
})
console.log(JSON.stringify(probe, null, 1))
await task.finish({ keep: [] })
process.exit(0)
