// 2026-11-13 round-23:手机端工序报工 —— 超量弹窗 E2E(5173 源码即时生效;手机视口 390x844 dpr2)
const task = await taskSpace('mob-report-cap-20261113')
const page = task.page('p1')
const BASE = 'http://localhost:5173'
const OUT = 'C:/Users/vigna/ego/mob-report-cap-20261113/'
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
// 手机比例(iPhone 12:390x844,DPR2)
try {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  console.log('emulation=390x844 dpr2')
} catch (e) { console.log('emu skip: ' + e.message) }
await page.goto(BASE + '/#/panelx/list/MOBILE_REPORT', { timeout: 40000 })
await page.waitForTimeout(6000)
await restoreWindow()
if (await page.evaluate(() => !!document.querySelector('input[type="password"]'))) {
  console.log('login required')
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')) ?? ins[0], 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')) ?? ins[1], '123456')
    document.querySelector('.login-form .el-select')?.click()
  })
  await page.waitForTimeout(1200)
  await page.evaluate(() => { const items = [...document.querySelectorAll('.el-select-dropdown__item')]; const el = items.find((x) => { const t = (x.textContent || '').trim(); return t.includes('YINJIA-MES') && !t.includes('测试') }); if (el) el.click() })
  await page.waitForTimeout(500)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
  await page.waitForTimeout(6500)
  await page.goto(BASE + '/#/panelx/list/MOBILE_REPORT', { timeout: 40000 })
  await page.waitForTimeout(6000)
}
await restoreWindow()
console.log('viewport=' + JSON.stringify(await page.evaluate(() => ({ iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio }))))
// ① 输入工单号 → 查询
const hasPage = await page.evaluate(() => !!document.querySelector('.mp'))
if (!hasPage) { console.log('PAGE_NOT_LOADED body=' + (await page.evaluate(() => (document.body.innerText || '').slice(0, 300)))); }
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const inp = document.querySelector('.mp-card input')
  if (inp) setVal(inp, 'GD-2026-11-0012')
})
await page.waitForTimeout(400)
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-row .el-button')].find((x) => (x.textContent || '').includes('查询')); if (b) b.click() })
await page.waitForTimeout(5000)
const opsInfo = await page.evaluate(() => [...document.querySelectorAll('.mp-op')].map((el) => ({
  name: (el.querySelector('.mp-op-name') || {}).textContent?.trim() || '',
  meta: (el.querySelector('.mp-op-meta') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  flow: (el.querySelector('.mp-op-flow') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  active: el.className,
})))
console.log('ops=' + JSON.stringify(opsInfo))
await page.screenshot({ path: OUT + 'round-01-mobile-loaded.png' })
// ② 选装箱 + 填 200 + 提交
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.mp-op')].find((x) => (x.querySelector('.mp-op-name') || {}).textContent?.trim() === '装箱')
  if (el) el.click()
})
await page.waitForTimeout(600)
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const inp = document.querySelector('.mp-qty input')
  if (inp) { inp.focus(); setVal(inp, '200'); inp.blur() }
})
await page.waitForTimeout(500)
console.log('hint=' + JSON.stringify(await page.evaluate(() => (document.querySelector('.mp-warn') || {}).textContent?.trim() || '')))
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-submit .el-button')].find((x) => (x.textContent || '').includes('提交报工')); if (b) b.click() })
await page.waitForTimeout(1800)
const dlg = await page.evaluate(() => {
  const d = document.querySelector('.mp-cap-dlg')
  if (!d) return { found: false }
  const title = (d.querySelector('.el-dialog__title') || {}).textContent?.trim() || ''
  const max = (d.querySelector('.mp-cap-max') || {}).textContent?.trim() || ''
  const lines = [...d.querySelectorAll('.mp-cap-line, .mp-cap-formula, .mp-cap-tip')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim())
  const btns = [...d.querySelectorAll('.mp-cap-actions .el-button')].map((b) => (b.textContent || '').trim())
  const r = d.getBoundingClientRect()
  return { found: true, title, max, lines, btns, w: Math.round(r.width), iw: innerWidth }
})
console.log('dialog=' + JSON.stringify(dlg))
await page.screenshot({ path: OUT + 'round-02-mobile-dialog.png' })
// ③ 点「改为 100」→ 数量应变成 100、弹窗关闭
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-cap-dlg .mp-cap-actions .el-button')].pop(); if (b) b.click() })
await page.waitForTimeout(900)
console.log('afterApply=' + JSON.stringify(await page.evaluate(() => ({
  dialogOpen: !!document.querySelector('.mp-cap-dlg .el-dialog__body'),
  qty: (document.querySelector('.mp-qty input') || {}).value || '',
}))))
await page.screenshot({ path: OUT + 'round-03-mobile-applied.png' })
// ④ 宽屏(电脑端同一组件)看弹窗比例
try { await page.cdp('Emulation.clearDeviceMetricsOverride', {}) } catch (e) { console.log('clear emu skip: ' + e.message) }
await page.waitForTimeout(800)
await restoreWindow()
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-submit .el-button')].find((x) => (x.textContent || '').includes('提交报工')); if (b) b.click() })
await page.waitForTimeout(1200)
console.log('wide dialog=' + JSON.stringify(await page.evaluate(() => {
  const d = document.querySelector('.mp-cap-dlg')
  if (!d) return { found: false }
  const r = d.getBoundingClientRect()
  return { found: true, w: Math.round(r.width), iw: innerWidth, title: (d.querySelector('.el-dialog__title') || {}).textContent?.trim() || '' }
})))
await page.screenshot({ path: OUT + 'round-04-wide-dialog.png' })
// 关掉弹窗(点「知道了」)
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-cap-dlg .mp-cap-actions .el-button')].find((x) => (x.textContent || '').includes('知道了')); if (b) b.click() })
await page.waitForTimeout(600)
console.log('DONE')
