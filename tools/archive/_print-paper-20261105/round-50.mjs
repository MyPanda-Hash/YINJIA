// round-50: 打开 A4 那张 PDF —— 内容应仍是 210×148mm 大小,贴在左上角(不缩放)
const task = await taskSpace(1)
const page = task.page('p1')
await page.goto('file:///D:/YINJIA-main/deploy/print-agent/print-out/GD-PAPER-A4_L1_20261105-113825-610.pdf', { timeout: 30000 })
await page.waitForTimeout(3000)
try {
  const shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/pdf-paper-a4.png' })
  console.log({ shot })
} catch (e) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await page.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(900)
    const s2 = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/pdf-paper-a4.png' })
    console.log({ shot: s2 })
  } catch (e2) { console.log('shot fail: ' + e2.message) }
}
