const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 切到测试库(正式库只录真实业务;本轮要真写一张单验证回填)
await page.click('text=YINJIA-MES·测试库')
await page.waitForTimeout(2500)
const afterSwitch = await page.evaluate(() => ({
  hash: location.hash,
  factoryText: (document.querySelector('.factory-name, .topbar-factory, header')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
  ls: { factory: localStorage.getItem('mes_factory') },
}))
console.log(JSON.stringify(afterSwitch, null, 2))

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(2500)
const info = await page.evaluate(() => ({
  hash: location.hash,
  title: document.querySelector('.labm-title')?.textContent?.trim(),
  tagline: document.querySelector('.labm-tagline')?.textContent?.trim(),
  sections: [...document.querySelectorAll('.labm-sec')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  fields: [...document.querySelectorAll('.labm-field > label')].map((e) => e.textContent.trim()),
  lines: [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  err: document.querySelector('.labm-err')?.textContent?.trim() || '',
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-03.png' })
