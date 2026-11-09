const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')

// ① 手机端:模糊查询(输「拍照联调」应命中手机端刚建的那张 EU-2026-11-0003)
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(4000)
const before = await page.evaluate(() => ({
  lines: [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  total: document.querySelector('.labm-sec-num')?.textContent?.trim(),
}))
console.log('before=' + JSON.stringify(before))

await page.fill('css:.labm-row input', '拍照联调')
await page.waitForTimeout(300)
await page.click('css:.labm-row .el-button')
await page.waitForTimeout(2500)
const after = await page.evaluate(() => ({
  lines: [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  total: document.querySelector('.labm-sec-num')?.textContent?.trim(),
  empty: document.querySelector('.labm-empty')?.textContent?.trim() || '',
}))
console.log('after=' + JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-41-search.png' })

// ② 清空关键字恢复全部
await page.fill('css:.labm-row input', '')
await page.waitForTimeout(200)
await page.click('css:.labm-row .el-button')
await page.waitForTimeout(2000)
const reset = await page.evaluate(() => ({
  lines: [...document.querySelectorAll('.labm-line')].length,
  total: document.querySelector('.labm-sec-num')?.textContent?.trim(),
}))
console.log('reset=' + JSON.stringify(reset))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-42-list.png' })
