// 2026-11-13 round-20:验「三数并列」提示(5173 源码即时生效 + 8090 新后端)
const task = await taskSpace('wo-dayplan-orig-20261113')
const page = task.page('p1')
const BASE = 'http://localhost:5173'
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
await page.goto(BASE + '/#/prod/plan/workOrderBoard', { timeout: 40000 })
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
  await page.waitForTimeout(6000)
  await page.goto(BASE + '/#/prod/plan/workOrderBoard', { timeout: 40000 })
  await page.waitForTimeout(6000)
}
await restoreWindow()
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith('1号车间'))
  if (el) el.click()
})
await page.waitForTimeout(4000)
const r = await page.evaluate(() => ({
  banner: (document.querySelector('.wb-short-bar') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  red: [...document.querySelectorAll('.wb-main .dp-plan.short')].map((el) => (el.textContent || '').trim()),
}))
console.log('5173 board=' + JSON.stringify(r))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-dayplan-orig-20261113/final-30-banner-3nums.png' })
// 生产工单页
await page.goto(BASE + '/#/prod/plan/workOrderList', { timeout: 40000 })
await page.waitForTimeout(7000)
await restoreWindow()
const r2 = await page.evaluate(() => ({
  banner: (document.querySelector('.wol-short') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
}))
console.log('5173 list=' + JSON.stringify(r2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-dayplan-orig-20261113/final-31-list-banner-3nums.png' })
console.log('DONE')
