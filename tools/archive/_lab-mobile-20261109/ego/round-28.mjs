const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.click('css:.fuzzy-back')
await page.waitForTimeout(800)
const side = await page.evaluate(() => [...document.querySelectorAll('.approval-side .as-side-btn, .approval-side [class*=side-item], .approval-side .as-item')]
  .filter((e) => e.offsetParent !== null)
  .map((e) => ({ cls: e.className, txt: (e.textContent || '').replace(/\s+/g, ' ').trim() })).slice(0, 20))
console.log(JSON.stringify(side, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-28-side.png' })
