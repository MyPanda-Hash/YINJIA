const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(5000)
const lg = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json()
  if (j.code !== 200) return { err: j.message }
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user))
  localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
  return { ok: true }
})
console.log('login:', JSON.stringify(lg))
await page.reload()
await page.waitForTimeout(9000)
const out = {}
for (const [panel, label] of [['RD_MOLD_PROC','烧结工艺/配方'], ['RD_X_SINTER','X烧结'], ['RD_PROD_INFO','产品信息表']]) {
  await page.evaluate((p) => { location.hash = '#/panelx/list/' + p }, panel)
  await page.waitForTimeout(7000)
  const docno = await page.evaluate(() => {
    const el = document.querySelector('.rs-docno-static, .rsp-cover-docno-val, .rs-docno')
    return el ? (el.innerText || '').trim() : '(未找到编号格)'
  })
  out[label] = docno
  console.log(`  ${label} (${panel}) 右上角 =`, docno)
}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_1117-fix-20261117/docno.png' })
await task.finish({ keep: [] })
process.exit(0)
