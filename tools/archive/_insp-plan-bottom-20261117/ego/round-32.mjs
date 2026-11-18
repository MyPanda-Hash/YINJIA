// round-32:把浏览器账套切回正式库 YJ,并在正式库的 B-92-25 那张单据上做最终确认
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/?cb=' + Date.now() + '#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(8000)
// 账套切回正式库
const cur = await page.evaluate(() => {
  const el = document.querySelector('.topbar .factory')
  return el ? (el.textContent || '').trim() : null
})
console.log('current factory:', cur)
if (cur && cur.includes('测试')) {
  await page.evaluate(() => { document.querySelector('.topbar .factory').click() })
  await page.waitForTimeout(1000)
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-dropdown-menu__item')]
    const t = items.find((e) => (e.textContent || '').trim() === 'YINJIA-MES')
    if (t) t.click()
  })
  await page.waitForTimeout(1500)
  const submitted = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('切换账套'))
    if (!dlg) return 'no dialog'
    const inp = dlg.querySelector('input')
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(inp, '123456')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    const btn = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').includes('切换并重新登录'))
    if (btn) { btn.click(); return 'clicked' }
    return 'no btn'
  })
  console.log('switch back:', submitted)
  await page.waitForTimeout(8000)
}
console.log(JSON.stringify(await page.evaluate(() => {
  let claims = null
  try {
    const raw = (localStorage.getItem('mes_token') || '').replace(/^"|"$/g, '')
    const p = JSON.parse(atob(raw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    claims = p.factory
  } catch (e) {}
  return { claims, topFactory: (document.querySelector('.topbar .factory') || {}).textContent, hash: location.hash }
}), null, 2))
// 打开正式库里那张 B-92-25(IP-2026-10-0011),看底部
await page.goto('about:blank')
await page.goto('http://localhost:5173/?cb=' + Date.now() + '#/panelx/list/RD_INSP_PLAN?docNo=IP-2026-10-0011', { timeout: 60000 })
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const ff = document.querySelector('.rsp-footer-field')
  if (ff) ff.scrollIntoView({ block: 'center' })
})
await page.waitForTimeout(800)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-32-prod-final.png' })
console.log(JSON.stringify(await page.evaluate(() => ({
  headers: [...document.querySelectorAll('table.rs-dt th')].map((e) => (e.textContent || '').trim()).slice(0, 8),
  footer: (document.querySelector('.rsp-footer-field') || {}).textContent,
  tableW: document.querySelector('table.rs-dt') ? document.querySelector('table.rs-dt').getBoundingClientRect().width : null,
})), null, 2))
