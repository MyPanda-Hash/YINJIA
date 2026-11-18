const PANELS = ['RD_ASM_BOM','RD_EXTRA_REC_FILE','RD_MOLD_FORMULA']
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
for (const p of PANELS) {
  await page.evaluate((c) => { location.hash = '#/panelx/list/' + c }, p)
  await page.waitForTimeout(7000)
  // 点第一行打开单据
  const clicked = await page.evaluate(() => {
    const row = document.querySelector('.el-table__row, .dsr-item, .el-table__body tr')
    if (row) { row.click(); return (row.innerText || '').replace(/\s+/g, ' ').slice(0, 24) }
    return null
  })
  await page.waitForTimeout(5000)
  const info = await page.evaluate(() => {
    const paper = document.querySelector('.rsp-sheet, .approval-sheet')
    const pr = paper ? paper.getBoundingClientRect() : null
    let bad = null
    if (paper && pr && pr.width > 10) {
      let maxW = 0, cls = ''
      for (const el of paper.querySelectorAll('*')) {
        const w = el.getBoundingClientRect().width
        if (w > maxW) { maxW = w; cls = String(el.className).slice(0, 28) }
      }
      bad = { paperW: Math.round(pr.width), maxW: Math.round(maxW), over: Math.round(maxW - pr.width), cls }
    }
    return { click: null, paperPresent: !!pr, ...(bad || {}) }
  })
  console.log(p.padEnd(18), 'clickedRow=', JSON.stringify(clicked), '→', JSON.stringify(info))
}
await task.finish({ keep: [] })
process.exit(0)
