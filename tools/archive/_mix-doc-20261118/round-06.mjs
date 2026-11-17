/**
 * round-06:手机竖屏(390×844)看两个页面的版面 —— 这是现场真正用的尺寸。
 * ① 列表页(查询 + 扫码定位 + 未完成/已完成);② 明细页(抬头 + 秤 + 扫码 + 明细 + 提交)。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
})
await page.waitForTimeout(500)

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.click('.mm-grp-head >> nth=1')
await page.waitForTimeout(800)
const listInfo = await page.evaluate(() => ({
  groups: [...document.querySelectorAll('.mm-grp-head')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  docs: [...document.querySelectorAll('.mm-doc')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()).slice(0, 6),
  hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  scrollWidth: document.documentElement.scrollWidth,
  viewport: window.innerWidth,
}))
console.log('== 列表页(390 宽) ==')
console.log(JSON.stringify(listInfo, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-06-mobile-list.png' })

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.fill('input[placeholder*="扫物料码"]', 'YJ-TJHZ-001|20261118001')
await page.keyboard.press('Enter')
await page.waitForTimeout(1800)
const docInfo = await page.evaluate(() => ({
  hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  scrollWidth: document.documentElement.scrollWidth,
  viewport: window.innerWidth,
  unlocked: (document.querySelector('.mp-mat') || {}).innerText || '',
  qtyVisible: !!document.querySelector('.mp-qty input'),
  progress: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()).find((t) => t.startsWith('混料进度')) || '',
}))
console.log('== 明细页解锁(390 宽) ==')
console.log(JSON.stringify(docInfo, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-06-mobile-doc.png' })

// 收起这次临时解锁(不留脏草稿给现场)
await page.click('.mp-qty button:last-of-type')
await page.waitForTimeout(600)
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
