const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.waitForTimeout(4000)
// 展开品质管理大菜单
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.menu-item, .nav-item, a, span, div')].find((e) => (e.innerText || '').trim() === '品质管理' && e.offsetParent && e.children.length <= 2)
  if (el) el.click()
})
await page.waitForTimeout(2500)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    menuTexts: [...document.querySelectorAll('.mega-menu a, .mega-menu li, .submenu a, .submenu li, .menu-panel a, .menu-panel li, .module-menu a, .module-menu li')]
      .map((e) => txt(e)).filter((t) => t && t.length < 30).slice(0, 60),
    bodyHasNew: txt(document.body).includes('出货检验（功能）') && txt(document.body).includes('出货检验（表观）'),
    bodyHasOld: txt(document.body).includes('出货检验单功能'),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s32-menu.png' })
