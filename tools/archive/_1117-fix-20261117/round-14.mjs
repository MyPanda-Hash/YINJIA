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
await page.evaluate(() => { location.hash = '#/panelx/list/RD_ASM_PROC' })
await page.waitForTimeout(11000)
const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.as-info-row')]
  const val = (label) => {
    const r = rows.find(x => (x.innerText || '').includes(label))
    if (!r) return null
    const inp = r.querySelector('input')
    return inp ? (inp.value || '(input空)') : (r.innerText || '').replace(/\s+/g, ' ').trim()
  }
  return { 表单管理人: val('表单管理人'), 审核人: val('审核人'), 密级: val('密级'), infoCount: rows.length }
})
console.log('组装工艺 当前单据表头:', JSON.stringify(info, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_1117-fix-20261117/asm-manager.png' })
await task.finish({ keep: [] })
process.exit(0)
