const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/sys/org', { timeout: 60000 })
await page.waitForTimeout(9000)
const st = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.perm-table thead th')].map((e) => (e.textContent || '').trim())
  // 折叠面板要找「角色与面板权限」
  const groups = [...document.querySelectorAll('.perm-collapse .el-collapse-item__header, .el-collapse-item__header')].map((e) => (e.textContent || '').trim()).slice(0, 6)
  return { ths: ths.slice(0, 20), groups, hasEditOthers: ths.some((t) => t === '改他人行'), rowSample: [...document.querySelectorAll('.perm-table tbody tr')].slice(0, 3).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)) }
})
console.log('组织架构 =', JSON.stringify(st, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-org-editothers2.png' })
console.log('shot =', shot)
