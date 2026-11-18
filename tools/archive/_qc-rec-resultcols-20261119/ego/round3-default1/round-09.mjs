// round-09:诊断打印态下列宽到底怎么算的(--qr-res-w 值 / 各列计算宽度)
const task = await taskSpace('qc-insp-rec-default1-20261119')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(5000)

await page.evaluate(() => document.body.classList.add('approval-printing'))
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 1, mobile: false })
await page.waitForTimeout(900)

const diag = await page.evaluate(() => {
  const table = document.querySelector('.qr-table')
  const rows = [...document.querySelectorAll('.qr-table tbody tr')]
  const ths = [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')]
  const head2 = [...document.querySelectorAll('.qr-table thead tr:nth-child(1) th')].map((th) => ({
    cls: th.className, colspan: th.colSpan, w: Math.round(th.getBoundingClientRect().width),
    styleW: th.style.width, computedW: getComputedStyle(th).width,
  }))
  return {
    tableW: Math.round(table.getBoundingClientRect().width),
    tableStyle: { minWidth: table.style.minWidth, resVar: table.style.getPropertyValue('--qr-res-w'), scaleVar: table.style.getPropertyValue('--qr-base-scale') },
    csRes: getComputedStyle(document.documentElement).getPropertyValue('--qr-res-w'),
    head1: head2,
    resultThs: ths.map((th) => ({ w: Math.round(th.getBoundingClientRect().width), styleW: th.style.width, computedW: getComputedStyle(th).width })),
    rows: rows.length,
  }
})
console.log(JSON.stringify(diag, null, 2))

await page.cdp('Emulation.clearDeviceMetricsOverride')
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
await page.evaluate(() => document.body.classList.remove('approval-printing'))
