const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/panelx/list/RD_MOLD_PROC', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)
const st = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td')]
  const cells = tds.filter((td) => td.querySelector('.el-select') && [...td.querySelectorAll('span,div')].some((e) => (e.textContent || '').trim() === '⧉ 标准库维护'))
  return cells.map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30))
})
console.log('页面已刷新；含下拉+维护的格 =', JSON.stringify(st))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-workshop-final.png' })
console.log('shot =', shot)
