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
await page.evaluate(() => { location.hash = '#/panelx/list/RD_PROD_INFO' })
await page.waitForTimeout(11000)
const info = await page.evaluate(() => {
  const libs = [...document.querySelectorAll('.rs-lib-btn')].map(e => (e.innerText || '').trim())
  // 应用场景 那一行右侧的值格里是否有 select 或 标准库按钮
  const rows = [...document.querySelectorAll('tr')]
  const hit = rows.find(r => (r.innerText || '').includes('应用场景'))
  const selects = hit ? hit.querySelectorAll('.el-select').length : -1
  const libBtn = hit ? hit.querySelectorAll('.rs-lib-btn').length : -1
  return { libBtnTotal: libs.length, sceneRowSelects: selects, sceneRowLibBtns: libBtn,
    sceneRowText: hit ? (hit.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60) : null }
})
console.log('应用场景行:', JSON.stringify(info, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_1117-fix-20261117/prodinfo-scene.png' })
await task.finish({ keep: [] })
process.exit(0)
