const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
// 点右上角用户区，看看菜单项
const clicked = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const cands = [...document.querySelectorAll('div,span,a,li')].filter((el) => {
    const t = txt(el)
    return t === '系统管理员' && el.offsetParent
  })
  if (!cands.length) return 'not found'
  const el = cands[cands.length - 1]
  el.click()
  return `clicked ${el.tagName}.${(el.className || '').toString().slice(0, 40)}`
})
await page.waitForTimeout(1200)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    clicked: document.activeElement ? document.activeElement.tagName : '',
    menuTexts: [...document.querySelectorAll('.el-dropdown-menu__item, .el-menu-item, li')]
      .map((el) => txt(el)).filter((t) => t && t.length < 12).slice(0, 30),
  }
})
console.log(JSON.stringify({ clicked, info }, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s5-usermenu.png' })
