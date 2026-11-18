const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(5000)
const lg = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json(); if (j.code !== 200) return { err: j.message }
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user))
  localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
  return { ok: true }
})
console.log('login:', JSON.stringify(lg))
await page.reload(); await page.waitForTimeout(9000)
await page.evaluate(() => { location.hash = '#/panelx/list/RD_ASM_PROC' })
await page.waitForTimeout(11000)
const info = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.rsp-pages [class*="tab"], .rsp-pages > *')]
    .map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(t => t && t.length < 20)
  const body = document.body.innerText
  const labels = ['表单管理人', '审核人', '密级', '使用范围', '版本号']
  const infoVals = {}
  for (const l of labels) {
    const i = body.indexOf(l)
    infoVals[l] = i >= 0 ? body.slice(i, i + 30).replace(/\s+/g, ' ').trim() : null
  }
  return { tabs: [...new Set(tabs)].slice(0, 6), infoVals, hasAuditor: body.includes('审核人') }
})
console.log('页签:', JSON.stringify(info.tabs))
console.log('信息栏:', JSON.stringify(info.infoVals, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_1117-fix-20261117/asm-proc.png' })
await task.finish({ keep: [] })
process.exit(0)
