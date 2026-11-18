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
  const vis = [...document.querySelectorAll('table.rs-t.rs-dt')].filter(x => x.getBoundingClientRect().width > 0)
  const t = vis[0]
  if (!t) return { found: false }
  const cs = getComputedStyle(t)
  const r = t.getBoundingClientRect()
  const cols = [...t.querySelectorAll('colgroup col')].map(c => ({ attr: c.getAttribute('style'), w: getComputedStyle(c).width }))
  const ths = [...t.querySelectorAll('th')].map(th => ({ t: (th.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 8), w: Math.round(th.getBoundingClientRect().width), cs: th.colSpan }))
  // 第一行数据行每个 td 的最宽子元素
  const firstTd = [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children]).find(cells => cells.length > 3) || []
  const cells = firstTd.map(td => {
    const r2 = td.getBoundingClientRect()
    let maxChild = null
    for (const ch of td.querySelectorAll('*')) {
      const w = ch.getBoundingClientRect().width
      if (!maxChild || w > maxChild.w) maxChild = { tag: ch.tagName, cls: String(ch.className).slice(0, 26), w: Math.round(w) }
    }
    return { w: Math.round(r2.width), text: (td.innerText || '').slice(0, 14), maxChild }
  })
  return { found: true, tableW: Math.round(r.width), cssWidth: cs.width, tableLayout: cs.tableLayout,
           visCount: vis.length, cols, ths, cells }
})
console.log(JSON.stringify(probe, null, 1))
await task.finish({ keep: [] })
process.exit(0)
