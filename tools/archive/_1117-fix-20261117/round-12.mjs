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
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.getBoundingClientRect().height > 100)
  const row = [...dlg.querySelectorAll('tbody tr')][0]
  row?.querySelector('td')?.click()
})
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.getBoundingClientRect().height > 100)
  const b = [...dlg.querySelectorAll('button')].find(x => /确定|确认/.test(x.innerText || ''))
  b?.click()
})
await page.waitForTimeout(3000)
const head = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.as-info-row')].map(r => (r.innerText || '').replace(/\s+/g, ' ').trim())
  return { infoRows: rows.slice(0, 6) }
})
console.log('选客户后:', JSON.stringify(head))
// 保存
const saved = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, .el-button')].find(x => (x.innerText || '').trim() === '保存')
  if (b) { b.click(); return true }
  return false
})
console.log('点保存:', saved)
await page.waitForTimeout(6000)
const after = await page.evaluate(() => {
  const msg = [...document.querySelectorAll('.el-message, .el-message__content')].map(e => (e.innerText || '').trim())
  const rows = [...document.querySelectorAll('.as-info-row')].map(r => (r.innerText || '').replace(/\s+/g, ' ').trim())
  return { toast: msg.slice(0, 2), infoRows: rows.slice(0, 6) }
})
console.log('保存后:', JSON.stringify(after))
await task.finish({ keep: [] })
process.exit(0)
