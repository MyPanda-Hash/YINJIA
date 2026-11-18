const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false })
async function loginAs(u, p) {
  return page.evaluate(async ([u, p]) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p, factory: 'YJ' }) })
    const j = await r.json()
    if (j.code !== 200) return { err: j.message }
    localStorage.setItem('mes_token', j.data.token)
    localStorage.setItem('mes_user', JSON.stringify(j.data.user))
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
    return { ok: true }
  }, [u, p])
}
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(4000)
console.log('login admin:', JSON.stringify(await loginAs('admin', '123456')))
await page.goto('http://36.140.66.163:8090/#/panelx/list/RD_PLAN')
await page.reload()
await page.waitForTimeout(11000)
const before = await page.evaluate(() => ({ hash: location.hash, tabs: [...document.querySelectorAll('.tab, .tabs-item, [class*="tab"] span')].map(e=>(e.innerText||'').trim()).filter(t=>t&&t.length<20).slice(0,10) }))
console.log('打开面板后:', JSON.stringify(before))
// 真实点击「退出」
const clicked = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('*')].filter(e => (e.innerText||'').trim() === '系统管理员' || e.className && String(e.className).includes('user'))
  const trigger = cands.find(e => e.getBoundingClientRect().width > 0)
  if (trigger) { trigger.click(); return { clicked: 'user-trigger', tag: trigger.tagName }; }
  return { clicked: null }
})
console.log('点击用户菜单:', JSON.stringify(clicked))
await page.waitForTimeout(1200)
const done = await page.evaluate(() => {
  const item = [...document.querySelectorAll('*')].find(e => (e.innerText||'').trim() === '退出')
  if (!item) return { found: false, texts: [...document.querySelectorAll('.el-dropdown-menu__item')].map(e=>(e.innerText||'').trim()).slice(0,6) }
  item.click()
  return { found: true }
})
console.log('点击退出:', JSON.stringify(done))
await page.waitForTimeout(3500)
const afterLogout = await page.evaluate(() => ({ hash: location.hash, hasToken: !!localStorage.getItem('mes_token') }))
console.log('退出后:', JSON.stringify(afterLogout))
console.log('login sampler:', JSON.stringify(await loginAs('sampler', '123456')))
await page.goto('http://36.140.66.163:8090/#/dashboard')
await page.waitForTimeout(6000)
const after = await page.evaluate(() => ({ hash: location.hash, title: document.title }))
console.log('切换账号登录后:', JSON.stringify(after))
await task.finish({ keep: [] })
process.exit(0)
