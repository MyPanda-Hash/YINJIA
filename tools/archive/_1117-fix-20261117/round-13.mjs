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
const readVal = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll('.as-info-row')]
  const r = rows.find(x => (x.innerText || '').includes('立项编号'))
  const inp = r ? r.querySelector('input') : null
  return { labelFound: !!r, inputValue: inp ? inp.value : '(无 input)', inputCount: r ? r.querySelectorAll('input').length : 0 }
})
console.log('选客户前 立项编号:', JSON.stringify(await readVal()))
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
await page.waitForTimeout(3500)
console.log('选客户后 立项编号:', JSON.stringify(await readVal()))
const cust = await page.evaluate(() => {
  const row = [...document.querySelectorAll('.as-row')].find(r => (r.innerText || '').includes('客户名'))
  const inp = row?.querySelector('input, textarea')
  return { value: inp ? inp.value : '(无)', text: (row?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) }
})
console.log('客户名:', JSON.stringify(cust))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_1117-fix-20261117/docno-auto3.png' })
await task.finish({ keep: [] })
process.exit(0)
