const PANELS = ['RD_SHARE_FILE','RD_ASM_BOM','RD_EXTRA_REC_FILE','RD_FILTER_EFF','RD_MOLD_FORMULA','RD_PROD_DOCLIST','RD_PROGRESS']
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
  const info = await page.evaluate(() => {
    const paper = document.querySelector('.rsp-sheet, .approval-sheet')
    const pr = paper ? paper.getBoundingClientRect() : null
    const rows = document.querySelectorAll('.el-table__row, .dsr-item, .rs-list-row').length
    let maxW = 0, maxCls = ''
    if (paper && pr && pr.width > 10) {
      for (const el of paper.querySelectorAll('*')) {
        const w = el.getBoundingClientRect().width
        if (w > maxW) { maxW = w; maxCls = String(el.className).slice(0, 30) }
      }
    }
    return { paperW: pr ? Math.round(pr.width) : null, rows, maxW: Math.round(maxW), maxCls,
             bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 60) }
  })
  console.log(p.padEnd(18), JSON.stringify(info))
}
await task.finish({ keep: [] })
process.exit(0)
