// round-08:默认 1 格的屏幕态 + A4 打印态(1 列 / 3 列)版面
const task = await taskSpace('qc-insp-rec-default1-20261119')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6000)

const measure = async (tag) => {
  const st = await page.evaluate(() => {
    const table = document.querySelector('.qr-table')
    const cell = document.querySelector('.qr-table tbody tr:first-child td.c-res, .qr-table thead tr:nth-child(2) th.c-res')
    const r = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null)
    return {
      n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
      tableW: r(table),
      resW: r(cell),
      docW: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      printResW: getComputedStyle(document.documentElement).getPropertyValue('--qr-res-w').trim() || null,
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}

// ① 屏幕态:默认 1 格
await measure('screen-1col')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { /* skip */ }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-default1-20261119/round-08-screen-1col.png' })

// ② 打印态(1 列 / 3 列)A4
const printOn = async () => {
  await page.evaluate(() => document.body.classList.add('approval-printing'))
  await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 1, mobile: false })
  await page.waitForTimeout(900)
}
const printOff = async () => {
  await page.cdp('Emulation.clearDeviceMetricsOverride')
  await page.cdp('Emulation.setEmulatedMedia', { media: '' })
  await page.evaluate(() => document.body.classList.remove('approval-printing'))
  await page.waitForTimeout(600)
}
await printOn()
await measure('a4-1col')
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-default1-20261119/round-08-a4-1col.png', fullPage: true })
await printOff()

// 加到 3 列再打一次
await page.click('.c-result .qr-addcol', { label: '新增列' })
await page.waitForTimeout(400)
await page.click('.c-result .qr-addcol', { label: '再加一列' })
await page.waitForTimeout(600)
await printOn()
await measure('a4-3col')
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-default1-20261119/round-08-a4-3col.png', fullPage: true })
await printOff()
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
await measure('after-reload')
