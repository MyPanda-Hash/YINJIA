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
const probe = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.getBoundingClientRect().height > 100)
  const rows = dlg ? [...dlg.querySelectorAll('tbody tr')] : []
  const first = rows[0]
  // 从 DOM 行反查 Vue 组件的 rows 数据
  let comp = first?.__vueParentComponent
  let data = null
  for (let i = 0; i < 12 && comp; i++) {
    const ss = comp.setupState || {}
    if (Array.isArray(ss.rows?.value || ss.rows) && (ss.rows?.value || ss.rows).length) {
      const arr = ss.rows.value || ss.rows
      data = { keys: Object.keys(arr[0] || {}).slice(0, 40), sample: JSON.stringify(arr[0]).slice(0, 400) }
      break
    }
    comp = comp.parent
  }
  return data || { note: '未找到组件数据' }
})
console.log('参照行数据的键:', JSON.stringify(probe, null, 1))
await task.finish({ keep: [] })
process.exit(0)
