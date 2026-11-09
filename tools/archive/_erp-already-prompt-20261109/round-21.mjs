// round-21: 点「审批」组,看下拉里有没有「弃审」
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.waitForTimeout(500)
const r = await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '审批')
  if (!main) return 'no-main'
  // 组按钮:优先点右侧下拉箭头所在容器
  const group = main.closest('.tb-group') || main.parentElement
  const arrow = group?.querySelector('[class*="arrow"], .tb-caret, .el-icon')
  ;(arrow || main).dispatchEvent(new MouseEvent('click', { bubbles: true }))
  if (arrow && arrow.click) arrow.click()
  return 'clicked'
})
console.log('r=' + r)
await page.waitForTimeout(1200)
console.log('menu=' + JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('.tb-drop, .tb-drop-item, .el-dropdown-menu__item, .tools .el-popper li, .act-name')]
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 12).slice(0, 25))))
