// round-01 — 5173(vite,源码即时生效)打开快速排产页;若未登录则用测试账套登录;确认页面与待排产行可用
const task = await taskSpace('chain-order-guard-20261111')
console.log('spaceId=' + task.spaceId)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(5000)
let info = await page.evaluate(() => ({
  href: location.href,
  hasPassword: !!document.querySelector('input[type="password"]'),
  token: (localStorage.getItem('mes_token') || '').slice(0, 16),
  poolRows: (document.querySelectorAll('.el-table')[0]?.querySelectorAll('.el-table__body-wrapper tbody tr') || []).length,
  bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log('before=' + JSON.stringify(info))

if (info.hasPassword || !info.poolRows) {
  const login = await page.evaluate(async () => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
    })
    const j = await r.json().catch(() => ({}))
    const token = j?.data?.token || j?.token || null
    if (token) localStorage.setItem('mes_token', token)
    return { status: r.status, tokenSet: !!token, msg: j?.message || null }
  })
  console.log('login=' + JSON.stringify(login))
  await page.goto('http://localhost:5173/?t=' + Date.now() + '#/prod/plan/scheduleBoard', { timeout: 30000 })
  await page.waitForTimeout(6000)
  info = await page.evaluate(() => ({
    href: location.href,
    hasPassword: !!document.querySelector('input[type="password"]'),
    poolRows: (document.querySelectorAll('.el-table')[0]?.querySelectorAll('.el-table__body-wrapper tbody tr') || []).length,
    bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 260),
  }))
  console.log('afterLogin=' + JSON.stringify(info))
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_chain-order-guard-20261111/ego-shots/round-01-5173-page.png', fullPage: false })
console.log('shot round-01-5173-page.png')
