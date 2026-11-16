// round-09.mjs — 打印左侧导航的 DOM 结构(弄清用什么类名,方便后续点击)
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/BARCODE_MAT', { timeout: 40000 })
await page.waitForTimeout(2500)
const info = await page.evaluate(() => {
  const walk = []
  const root = document.querySelector('aside, .left-nav, .portal-nav, .el-aside') || document.body
  const nodes = [...root.querySelectorAll('*')].filter((el) => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
    return t === 'WMS管理' || t === '条码管理' || t === '材料仓条码管理'
  })
  for (const n of nodes) {
    walk.push({ tag: n.tagName, cls: n.className, text: n.textContent.replace(/\s+/g, ' ').trim(),
                parentCls: n.parentElement?.className })
  }
  return { rootCls: root.className, walk }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r9-nav-dom.png' })
