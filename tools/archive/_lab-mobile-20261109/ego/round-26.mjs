const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
const side = await page.evaluate(() => [...document.querySelectorAll('.as-side-btn, .fuzzy-btns span')]
  .filter((e) => e.offsetParent !== null)
  .map((e, i) => ({ i, cls: e.className, txt: (e.textContent || '').trim() })))
console.log(JSON.stringify(side, null, 2))
