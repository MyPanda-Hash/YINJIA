// round-14:打开「打印」组下拉(点 tb-group 里的 caret)→ 读菜单项
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const grp = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const nameSpan = [...document.querySelectorAll('span.act-name')].find((el) => t(el) === '打印')
  const group = nameSpan?.closest('.tb-group')
  return group ? group.outerHTML.slice(0, 800) : null
})
log('打印组 HTML=', grp)

// 点 caret(.tb-caret / 最后一个子元素)
const opened = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const nameSpan = [...document.querySelectorAll('span.act-name')].find((el) => t(el) === '打印')
  const group = nameSpan?.closest('.tb-group')
  if (!group) return 'no-group'
  const caret = group.querySelector('.tb-caret, .caret, .tb-arrow') || [...group.children].find((c) => c !== nameSpan?.closest('.tb-main'))
  if (!caret) return 'no-caret'
  caret.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  caret.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  caret.click?.()
  return `${caret.tagName}.${caret.className}`
})
log('点开=', opened)
await page.waitForTimeout(1200)
const items = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const cands = [...document.querySelectorAll('.tb-menu, .tb-dropdown, .el-dropdown-menu, .popper, .tb-pop')]
    .filter((el) => el.offsetParent !== null)
  return {
    containers: cands.map((el) => `${el.className} :: ${t(el).slice(0, 120)}`),
    acts: [...document.querySelectorAll('.tb-menu .act-name, .tb-dropdown .act-name, .tb-pop .act-name, .el-dropdown-menu__item')]
      .filter((el) => el.offsetParent !== null).map(t),
  }
})
log(JSON.stringify(items, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-14-menu.png' })
