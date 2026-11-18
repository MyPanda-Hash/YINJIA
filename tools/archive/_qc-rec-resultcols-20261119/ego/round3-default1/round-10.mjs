// round-10:5173 上验证打印态列宽修复(1/3/5/10/20 列,A4 794px)
const task = await taskSpace('qc-insp-rec-default1-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(5000)

const setCols = async (target) => {
  for (let guard = 0; guard < 45; guard++) {
    const n = await page.evaluate(() => Number(document.querySelector('.qr-colstep-num')?.textContent?.trim() || 0))
    if (n === target) return n
    if (n < target) {
      await page.evaluate(() => { const b = document.querySelector('.c-result .qr-addcol'); if (b) b.click() })
      await page.waitForTimeout(180)
    } else {
      await page.evaluate(() => { const b = document.querySelector('.qr-colstep > span:nth-child(2)'); if (b) b.click() })
      await page.waitForTimeout(320)
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('.el-message-box__btns button')].find((x) => (x.textContent || '').trim() === '确定')
        if (b) b.click()
      })
      await page.waitForTimeout(360)
    }
  }
  return -1
}

const printOn = async () => {
  await page.evaluate(() => document.body.classList.add('approval-printing'))
  await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 1, mobile: false })
  await page.waitForTimeout(800)
}
const printOff = async () => {
  await page.cdp('Emulation.clearDeviceMetricsOverride')
  await page.cdp('Emulation.setEmulatedMedia', { media: '' })
  await page.evaluate(() => document.body.classList.remove('approval-printing'))
  await page.waitForTimeout(500)
}

for (const n of [1, 3, 5, 10, 20]) {
  await setCols(n)
  await page.waitForTimeout(400)
  await printOn()
  const st = await page.evaluate(() => {
    const table = document.querySelector('.qr-table')
    const cells = [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th.c-res')]
    const band = document.querySelector('.qr-table thead tr:first-child th.c-result')
    const r = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null)
    const headText = (band?.textContent || '').replace(/\s+/g, ' ').trim()
    return {
      n: cells.length,
      tableW: r(table),
      bandW: r(band),
      resW: cells.length ? r(cells[0]) : null,
      bandText: headText,
      bandLines: band ? Math.round(band.getBoundingClientRect().height) : null,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })
  console.log('a4-' + n + ' ' + JSON.stringify(st))
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { /* skip */ }
  await page.screenshot({ path: `C:/Users/Lenovo/ego/qc-insp-rec-default1-20261119/round-10-a4-${n}col.png`, fullPage: true })
  await printOff()
}
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
