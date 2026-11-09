// round-23: 点「更多」看下拉项(找弃审)
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.waitForTimeout(300)
const state = await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '更多')
  if (!main) return 'no-main'
  const caret = main.closest('.tb-group')?.querySelector('.tb-caret')
  ;(caret || main).click()
  return 'clicked: cls=' + main.className
})
console.log(state)
await page.waitForTimeout(1500)
console.log('poppers=' + JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('.el-popper, .tb-drop, .tb-menu, .el-dropdown__popper')].map((el) => ({
    cls: String(el.className || '').slice(0, 40),
    hidden: el.style.display === 'none' || el.getAttribute('aria-hidden') === 'true',
    text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
  })).slice(0, 6))))
