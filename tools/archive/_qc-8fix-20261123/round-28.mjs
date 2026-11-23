// round-28: 侧栏菜单确认两张明细表入口
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.goto('http://127.0.0.1:8090/?m=' + Date.now() + '#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(7000)
// 展开 品质管理 -> 制程品质
const r = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll('.el-menu-item, .el-sub-menu__title, .menu-item, li, a')]
  const qc = nodes.find((n) => (n.innerText || '').trim() === '品质管理')
  if (qc) qc.click()
  return !!qc
})
await page.waitForTimeout(800)
const r2 = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll('.el-menu-item, .el-sub-menu__title, .menu-item, li, a')]
  const p = nodes.find((n) => (n.innerText || '').trim() === '制程品质')
  if (p) p.click()
  return !!p
})
await page.waitForTimeout(1200)
console.log(JSON.stringify(await page.evaluate(() => ({
  menuText: [...document.querySelectorAll('.el-menu, .sidebar, aside')].map((m) => (m.innerText || '').replace(/\s+/g, ' ')).join(' ').slice(0, 2000),
  hasFunc: (document.body.innerText || '').includes('出货检验（功能）明细表'),
  hasAsm: (document.body.innerText || '').includes('出货检验（表观）明细表'),
})), null, 1))
