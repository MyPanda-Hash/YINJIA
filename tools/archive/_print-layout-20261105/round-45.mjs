// round-45: 把抓到的打印 HTML 打开截图(等价于"打印预览"看到的样子)
const task = await taskSpace(1)
const page = task.page('p1')
await page.goto('file:///C:/Users/Lenovo/ego/pick-main-material-20261104/pick-slip-print.html', { timeout: 30000 })
await page.waitForTimeout(1500)
try {
  const shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/pick-slip-browser-print.png' })
  console.log({ shot })
} catch (e) { console.log('shot fail: ' + e.message) }
