/**
 * round-06:手机竖屏(390×844)看两页版面 —— 现场真正用的尺寸。
 */
const task = await taskSpace('return-doc-20261118')
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(400)

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })
const listMs = await page.evaluate(() => ({
  groups: [...document.querySelectorAll('.mr-grp-head')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  firstDoc: (document.querySelector('.mr-doc') || {}).innerText || '',
  hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  scrollWidth: document.documentElement.scrollWidth,
  viewport: window.innerWidth,
}))
console.log('== 列表页(390 宽) ==')
console.log(JSON.stringify(listMs, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-06-mobile-list.png' })

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN/doc?id=823', { timeout: 30000 })
await page.waitForTimeout(2800)
await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })
const docMs = await page.evaluate(() => ({
  title: (document.querySelector('.mp-title') || {}).innerText || '',
  state: (document.querySelector('.mp-state') || {}).innerText || '',
  kv: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  scrollWidth: document.documentElement.scrollWidth,
  viewport: window.innerWidth,
}))
console.log('== 明细页(390 宽) ==')
console.log(JSON.stringify(docMs, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-06-mobile-doc.png', fullPage: true })

// 解锁一项看窄屏下的解锁区与数量框
await page.fill('input[placeholder*="扫物料码"]', 'YJ-XWR-016')
await page.keyboard.press('Enter')
await page.waitForTimeout(1600)
const unlockedMs = await page.evaluate(() => ({
  mat: (document.querySelector('.mp-mat') || {}).innerText || '',
  qty: (document.querySelector('.mp-qty input') || {}).value || '',
  hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
}))
console.log('== 明细页解锁(390 宽) ==')
console.log(JSON.stringify(unlockedMs, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-06-mobile-unlock.png' })

// 收掉解锁态(不留临时状态)
await page.click('.mp-qty button:last-of-type')
await page.waitForTimeout(500)
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
