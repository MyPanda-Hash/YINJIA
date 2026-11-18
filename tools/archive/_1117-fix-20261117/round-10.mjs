const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
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
await page.evaluate(() => { location.hash = '#/panelx/list/RD_APPROVAL' })
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, .el-button')].find(x => (x.innerText || '').trim() === '新增')
  b?.click()
})
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.as-row')].find(r => (r.innerText || '').includes('客户名'))
  row?.querySelector('.as-ref-ctl')?.click()
})
await page.waitForTimeout(5000)
const info = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.getBoundingClientRect().height > 100)
  if (!dlg) return { found: false }
  const heads = [...dlg.querySelectorAll('th')].map(e => (e.innerText || '').trim()).filter(Boolean)
  const firstRow = [...dlg.querySelectorAll('tbody tr')][0]
  const cells = firstRow ? [...firstRow.querySelectorAll('td')].map(e => (e.innerText || '').trim()) : []
  return { found: true, title: (dlg.querySelector('.el-dialog__title')?.innerText || '').trim(), heads: heads.slice(0, 12), cells: cells.slice(0, 12) }
})
console.log(JSON.stringify(info, null, 1))
await task.finish({ keep: [] })
process.exit(0)
