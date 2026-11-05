// round-41: 打开打印出来的 PDF,看版式(二维码大小 / 空行是否还填订单号 / 续页)
const task = await taskSpace(1)
const page = task.page('p1')
await page.goto('file:///D:/YINJIA-main/deploy/print-agent/print-out/GD-LAYOUT-13_L1_20261105-105251-778.pdf', { timeout: 30000 })
await page.waitForTimeout(4000)
console.log(JSON.stringify({ url: await page.url(), title: await page.title() }))
try {
  const shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/pdf-13rows-p1.png' })
  console.log({ shot })
} catch (e) {
  console.log('shot fail: ' + e.message)
}
