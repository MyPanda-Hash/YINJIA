// round-42: 第 2 页(13 行单据的续页)+ 3 行单据(空行不得再填订单号)
const task = await taskSpace(1)
const page = task.page('p1')
await page.goto('file:///D:/YINJIA-main/deploy/print-agent/print-out/GD-LAYOUT-13_L1_20261105-105251-778.pdf#page=2', { timeout: 30000 })
await page.waitForTimeout(3500)
try {
  const s1 = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/pdf-13rows-p2.png' })
  console.log({ p2: s1 })
} catch (e) { console.log('p2 shot fail: ' + e.message) }

await page.goto('file:///D:/YINJIA-main/deploy/print-agent/print-out/GD-LAYOUT-3_L1_20261105-105240-732.pdf', { timeout: 30000 })
await page.waitForTimeout(3500)
try {
  const s2 = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/pdf-3rows.png' })
  console.log({ p3: s2 })
} catch (e) { console.log('3rows shot fail: ' + e.message) }
