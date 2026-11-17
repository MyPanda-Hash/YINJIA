// round-10.mjs — WMS管理 下的「条码管理」模块页签 = 应只有 3 个只读条码面板
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/BARCODE_MAT', { timeout: 40000 })
await page.waitForTimeout(2500)
const state = await page.evaluate(() => ({
  group: document.querySelector('.nav-group.active .nav-group-title, .nav-group.active')?.textContent?.replace(/\s+/g, ' ').trim() || '',
  modules: [...document.querySelectorAll('.nav-modules .nav-module')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  tabs: [...document.querySelectorAll('.tabs .tab')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r10-barcode-tabs.png' })
