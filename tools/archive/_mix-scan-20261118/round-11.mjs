// round-11.mjs — 点开侧栏「条码管理」模块,把它下面的叶子列出来(应只剩三个只读面板)
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/BARCODE_MAT', { timeout: 40000 })
await page.waitForTimeout(2200)

await page.evaluate(() => {
  const mod = [...document.querySelectorAll('.nav-module')]
    .find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '条码管理')
  if (mod) { mod.click(); return true }
  return false
})
await page.waitForTimeout(1500)

const leaves = await page.evaluate(() => {
  const mod = [...document.querySelectorAll('.nav-module')]
    .find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '条码管理')
  const box = mod?.closest('.nav-group') || document.body
  return [...box.querySelectorAll('.tab, .nav-leaf, .nav-item, .leaf, a')]
    .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t && t.length < 30)
})
console.log('WMS管理 下所有叶子:', JSON.stringify(leaves, null, 2))
const hasOld = leaves.some((t) => /扫码领料|工单扫码领料|扫码领料记录/.test(t))
console.log('是否还有被删的三个扫码入口 =', hasOld)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r11-barcode-leaves.png' })
