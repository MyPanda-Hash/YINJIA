const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false })
async function loginAs() {
  return page.evaluate(async () => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
    const j = await r.json()
    if (j.code !== 200) return { err: j.message }
    localStorage.setItem('mes_token', j.data.token)
    localStorage.setItem('mes_user', JSON.stringify(j.data.user))
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
    return { ok: true }
  })
}
const tabTexts = () => page.evaluate(() =>
  [...document.querySelectorAll('.tabs-bar .tab, .portal-tabs .tab, [class*="tab"]')]
    .map(e => (e.innerText || '').replace(/\s+/g, ' ').trim())
    .filter(t => t && t.length < 24))

await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(4500)
await loginAs()
await page.reload()
await page.waitForTimeout(9000)
// 打开两个面板
await page.evaluate(() => { location.hash = '#/panelx/list/RD_PLAN' })
await page.waitForTimeout(6000)
await page.evaluate(() => { location.hash = '#/panelx/list/RD_PROD_INFO' })
await page.waitForTimeout(6000)
const before = await tabTexts()
console.log('登出前页签:', JSON.stringify([...new Set(before)]))

// 真实登出（点用户菜单 → 退出）
await page.evaluate(() => {
  const t = [...document.querySelectorAll('*')].find(e => (e.innerText||'').trim() === 'admin' && e.getBoundingClientRect().width > 0)
  t?.click()
})
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('*')].find(e => (e.innerText||'').trim() === '退出')
  it?.click()
})
await page.waitForTimeout(3000)
const afterLogout = await page.evaluate(() => ({ hash: location.hash, token: !!localStorage.getItem('mes_token') }))
console.log('登出后:', JSON.stringify(afterLogout))

await loginAs()
await page.reload()
await page.waitForTimeout(9000)
const after = await tabTexts()
const info = await page.evaluate(() => ({ hash: location.hash, bodyHasPlan: document.body.innerText.includes('项目实施计划') }))
console.log('重新登录后页签:', JSON.stringify([...new Set(after)]))
console.log('重新登录后落点:', JSON.stringify(info))
await task.finish({ keep: [] })
process.exit(0)
