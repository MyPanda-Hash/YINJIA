const BASE = 'http://127.0.0.1:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/login', { timeout: 60000 })
await page.waitForTimeout(3200)
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号')); const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
})
await page.waitForTimeout(400)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
await page.waitForTimeout(6000)
try { await page.cdp('Network.clearBrowserCache', {}) } catch (e) {}
await page.goto(BASE + '/#/panelx/list/RD_SPEC_DOC', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.evaluate(() => {
  const t = [...document.querySelectorAll('[class*="page-tab"]')].find((e) => (e.textContent || '').includes('检验项目及标准'))
  if (t) t.click()
})
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('.rs-lib-btn, .rsp-lib-pick, [class*="lib-btn"]')]
  const el = cands.find((e) => (e.textContent || '').includes('从标准库勾选')) || cands[0]
  if (el) el.click()
})
await page.waitForTimeout(4000)
const dump = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('检验项目标准库')).pop()
  if (!dlg) return { error: 'NO_DIALOG' }
  const groups = [...dlg.querySelectorAll('.lib-group')].map((g, i) => ({
    n: i + 1,
    name: ((g.querySelector('.lib-group-name') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    subs: [...g.querySelectorAll('.lib-sub-name')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8),
  }))
  return { count: groups.length, groups }
})
console.log('组数 =', dump.count)
for (const g of dump.groups) console.log(`${g.n}. ${g.name}  ::  ${g.subs.join(' / ')}`)
