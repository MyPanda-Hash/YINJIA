const BASE = 'http://127.0.0.1:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/login', { timeout: 60000 })
await page.waitForTimeout(3500)
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号')); const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
})
await page.waitForTimeout(400)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
await page.waitForTimeout(6000)
// 强制拿新 static:清 cache 后 reload(用 CDP 清缓存最稳)
try { await page.cdp('Network.clearBrowserCache', {}) } catch (e) { console.log('cache skip', e.message) }
await page.goto(BASE + '/#/panelx/list/RD_SPEC_DOC', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) {}
const state = await page.evaluate(() => ({ hash: location.hash, tabs: [...document.querySelectorAll('[class*="page-tab"]')].map((e) => (e.textContent || '').trim()), chunk: (document.querySelector('script[src*="index-"]') || {}).src || '' }))
console.log('state =', JSON.stringify(state))
const tab = await page.evaluate(() => {
  const t = [...document.querySelectorAll('[class*="page-tab"]')].find((e) => (e.textContent || '').includes('检验项目及标准'))
  if (!t) return 'NO_TAB'
  t.click(); return 'OK'
})
console.log('tab =', tab)
await page.waitForTimeout(2500)
const open = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('.rs-lib-btn, .rsp-lib-pick, [class*="lib-btn"]')]
  const el = cands.find((e) => (e.textContent || '').includes('从标准库勾选')) || cands[0]
  if (!el) return 'NO_BTN'
  el.click(); return 'CLICKED'
})
console.log('open =', open)
await page.waitForTimeout(3500)
const names = await page.evaluate(() => {
  const dlgs = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('检验项目标准库'))
  const dlg = dlgs[dlgs.length - 1]
  if (!dlg) return ['NO_DIALOG']
  return [...dlg.querySelectorAll('.lib-group')].map((g, i) => `${i + 1}. ` + ((g.querySelector('.lib-group-name') || {}).textContent || '').replace(/\s+/g, ' ').trim() + '  subs=' + g.querySelectorAll('.lib-sub-name, li').length)
})
console.log(JSON.stringify(names, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/after-8090.png' })
console.log('shot =', shot)
