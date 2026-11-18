// round-13:打印版面复核(百分比固定布局 + CSS 变量):5 / 10 / 20 列在 A4(794px)下都要压进一页
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0021', { timeout: 40000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(5000)

const setColsScreen = async (target) => {
  for (let guard = 0; guard < 45; guard++) {
    const n = await page.evaluate(() => Number(document.querySelector('.qr-colstep-num')?.textContent?.trim() || 0))
    if (n === target) return n
    if (n < target) {
      await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' })
      await page.waitForTimeout(170)
    } else {
      await page.click('.qr-colstep > span:nth-child(2)', { label: '减少检测结果列' })
      await page.waitForTimeout(330)
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('.el-message-box__btns button')].find((x) => (x.textContent || '').trim() === '确定')
        if (b) b.click()
      })
      await page.waitForTimeout(380)
    }
  }
  return -1
}

const measure = async (tag) => {
  const st = await page.evaluate(() => {
    const table = document.querySelector('.qr-table')
    const cell = document.querySelector('.qr-table tbody tr:first-child td.c-res')
    const item = document.querySelector('.qr-table tbody tr:first-child td.c-item')
    const judge = document.querySelector('.qr-table tbody tr:first-child td.c-judge')
    const r = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null)
    return {
      n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
      tableW: r(table), docW: document.documentElement.clientWidth,
      layout: table ? getComputedStyle(table).tableLayout : null,
      resW: r(cell), itemW: r(item), judgeW: r(judge),
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}

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

for (const n of [5, 10, 20]) {
  await setColsScreen(n)
  await page.waitForTimeout(400)
  await printOn()
  await measure('a4-' + n + '-cols')
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { /* skip */ }
  await page.screenshot({ path: `C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-13-a4-${n}cols.png`, fullPage: true })
  await printOff()
}
