// round-08.mjs — 展开侧栏「条码管理」看叶子(应只剩三个只读条码面板)
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/BARCODE_MAT', { timeout: 40000 })
await page.waitForTimeout(2500)

// 先展开「WMS管理」(若未展开),再展开「条码管理」
const clickByText = async (txt) => page.evaluate((t) => {
  const el = [...document.querySelectorAll('.el-sub-menu__title, .el-menu-item')]
    .find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === t)
  if (!el) return false
  el.click()
  return true
}, txt)
console.log('click WMS管理:', await clickByText('WMS管理'))
await page.waitForTimeout(900)
console.log('click 条码管理:', await clickByText('条码管理'))
await page.waitForTimeout(1200)

const menu = await page.evaluate(() => {
  const titles = [...document.querySelectorAll('.el-sub-menu__title, .el-menu-item')]
  const idx = titles.findIndex((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '条码管理')
  const after = idx >= 0 ? titles.slice(idx + 1, idx + 8).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()) : []
  return {
    allVisible: titles.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    afterBarcode: after,
    currentHash: location.hash,
  }
})
console.log('menu:', JSON.stringify(menu, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r8-barcode-expanded.png' })
