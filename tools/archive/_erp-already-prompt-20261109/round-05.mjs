// round-05: 对「已转」的单据 CGRK-20261014-03407 点「转ERP」→ 抓提示文案
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(6000)

// ① 找到「转ERP」下拉组并点击主按钮
const clicked = await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '转ERP')
  if (!main) return 'no-main'
  main.click()
  return 'clicked-main'
})
console.log('step1=' + clicked)
await page.waitForTimeout(1200)

// ② 若出现下拉菜单,点里面的「转ERP」
const step2 = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, .tb-drop-item, .el-dropdown-menu li, [class*="drop"] li')]
    .map((el) => (el.textContent || '').trim())
  const target = [...document.querySelectorAll('.el-dropdown-menu__item, .tb-drop-item, .el-dropdown-menu li, [class*="drop"] li')]
    .find((el) => (el.textContent || '').trim() === '转ERP')
  if (target) { target.click(); return 'clicked-item' }
  return 'items=' + JSON.stringify(items)
})
console.log('step2=' + step2)

// ③ 抓 toast
const seen = []
for (let i = 0; i < 30; i++) {
  const now = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((el) => ({
    text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    cls: String(el.className || ''),
  })))
  for (const m of now) if (!seen.some((s) => s.text === m.text)) seen.push(m)
  await page.waitForTimeout(200)
}
console.log('TOASTS=' + JSON.stringify(seen, null, 2))
console.log('docNo=' + await page.evaluate(() => (document.body.innerText.match(/单据：(CGRK-[0-9-]+)/) || [])[1]))
