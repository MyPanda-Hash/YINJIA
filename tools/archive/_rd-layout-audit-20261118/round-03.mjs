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
  const t = [...document.querySelectorAll('table.rs-t.rs-dt')].find(x => x.getBoundingClientRect().width > 0)
  if (!t) return { found: false }
  const cs = getComputedStyle(t)
  const cols = [...t.querySelectorAll('colgroup col')].map(c => ({
    style: c.getAttribute('style'), w: getComputedStyle(c).width,
  }))
  const ths = [...t.querySelectorAll('th')].map(th => ({
    text: (th.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 10),
    w: Math.round(th.getBoundingClientRect().width),
    colspan: th.colSpan,
  }))
  // 找它外层容器
  let p = t.parentElement, chain = []
  for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
    const r = p.getBoundingClientRect()
    chain.push({ cls: String(p.className).slice(0, 40), w: Math.round(r.width), scrollW: p.scrollWidth,
                 overflowX: getComputedStyle(p).overflowX })
  }
  return { found: true, tableW: Math.round(t.getBoundingClientRect().width),
           tableLayout: cs.tableLayout, width: cs.width, minWidth: cs.minWidth,
           cols, ths, chain }
})
console.log(JSON.stringify(probe, null, 1))
await task.finish({ keep: [] })
process.exit(0)
