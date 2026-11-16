// round-07.mjs — 条码管理只剩三个只读面板;已删除的三个地址变成 404
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/BARCODE_MAT', { timeout: 40000 })
await page.waitForTimeout(2500)

// 展开侧栏「WMS管理」→「条码管理」,读该组叶子
const menu = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.el-menu-item, .el-sub-menu__title')]
  const target = groups.find((el) => (el.textContent || '').includes('条码管理'))
  const box = target?.closest('.el-sub-menu') || target?.parentElement?.parentElement
  return {
    found: !!target,
    items: box ? [...box.querySelectorAll('.el-menu-item, .el-sub-menu__title')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()) : [],
  }
})
console.log('条码管理 menu:', JSON.stringify(menu, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r7-barcode-menu.png' })

// 已删除的三个地址:路由撤了 ⇒ 落到 404
const gone = []
for (const p of ['/scm/scanPick', '/scm/workOrderPick', '/scm/pickScanLog']) {
  await page.goto('http://127.0.0.1:8090/#' + p, { timeout: 30000 })
  await page.waitForTimeout(1200)
  gone.push({ path: p, hash: await page.evaluate(() => location.hash), title: await page.title() })
}
console.log('已删地址:', JSON.stringify(gone, null, 2))
