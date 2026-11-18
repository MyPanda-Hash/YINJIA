// round-05:顶栏账套切换器 → 切到 YINJIA-MES·测试库(密码 123456)
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(4500)
// 1) 顶栏左侧账套下拉
const opened = await page.evaluate(() => {
  const el = document.querySelector('.topbar .factory')
  if (!el) return false
  el.click()
  return (el.textContent || '').trim()
})
console.log('factory trigger:', JSON.stringify(opened))
await page.waitForTimeout(1000)
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item')]
  const t = items.find((e) => (e.textContent || '').includes('测试库'))
  if (t) { t.click(); return (t.textContent || '').trim() }
  return items.map((e) => (e.textContent || '').trim())
})
console.log('picked:', JSON.stringify(picked))
await page.waitForTimeout(1500)
// 2) 输密码并切换
const submitted = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('切换账套'))
  if (!dlg) return 'no dialog: ' + [...document.querySelectorAll('.el-dialog')].map((d) => d.textContent.trim().slice(0, 40))
  const inp = dlg.querySelector('input')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '123456')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  const btn = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').includes('切换并重新登录'))
  if (btn) { btn.click(); return 'clicked' }
  return 'no button'
})
console.log('submit:', submitted)
await page.waitForTimeout(8000)
console.log(JSON.stringify(await page.evaluate(() => {
  let claims = null
  try {
    const raw = (localStorage.getItem('mes_token') || '').replace(/^"|"$/g, '')
    const p = JSON.parse(atob(raw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    claims = { factory: p.factory, user: p.sub || p.username }
  } catch (e) { claims = 'decode fail' }
  return { claims, factoryCached: localStorage.getItem('mes_factory'), topFactory: (document.querySelector('.topbar .factory') || {}).textContent, hash: location.hash }
}), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-05.png' })
