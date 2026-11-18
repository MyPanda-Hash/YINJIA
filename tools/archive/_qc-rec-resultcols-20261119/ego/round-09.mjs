// round-09:A4 真实宽度下的打印版面(Emulation: print media + 794px 宽 = A4 96dpi)
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(4500)

const setCols = async (target) => {
  // 用步进器调到目标列数(从当前列数出发)
  for (let guard = 0; guard < 40; guard++) {
    const n = await page.evaluate(() => Number(document.querySelector('.qr-colstep-num')?.textContent?.trim() || 0))
    if (n === target) return n
    await page.click(n < target ? '.qr-colstep > span:nth-child(4)' : '.qr-colstep > span:nth-child(2)', { label: '调整列数' })
    await page.waitForTimeout(n > target ? 320 : 180)
    if (n > target) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('.el-message-box__btns button')].find((x) => (x.textContent || '').trim() === '确定')
        if (b) b.click()
      })
      await page.waitForTimeout(400)
    }
  }
  return target
}

const measure = async (tag) => {
  const st = await page.evaluate(() => {
    const table = document.querySelector('.qr-table')
    const sheet = document.querySelector('.qc-rec-sheet')
    return {
      n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
      tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
      sheetW: sheet ? Math.round(sheet.getBoundingClientRect().width) : null,
      layout: table ? getComputedStyle(table).tableLayout : null,
      docW: document.documentElement.clientWidth,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}

await page.evaluate(() => document.body.classList.add('approval-printing'))
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 1, mobile: false })
await page.waitForTimeout(1000)

for (const n of [5, 10, 20]) {
  await setCols(n)
  await page.waitForTimeout(700)
  await measure('a4-' + n + '-cols')
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { /* skip */ }
  await page.screenshot({ path: `C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-09-a4-${n}cols.png`, fullPage: true })
}

// 复位模拟
await page.cdp('Emulation.clearDeviceMetricsOverride')
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
await page.evaluate(() => document.body.classList.remove('approval-printing'))
