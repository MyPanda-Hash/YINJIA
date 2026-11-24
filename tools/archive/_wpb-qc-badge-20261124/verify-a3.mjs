const task = await taskSpace('wpb-qc-preview-20261124')
const page = task.page('p1')
async function waitFor(expr, ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { if (await page.evaluate(expr)) return true; await page.waitForTimeout(600) }
  return false
}
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 40000 })
await page.evaluate(() => location.reload())
await page.waitForTimeout(1800)
await waitFor(() => document.querySelectorAll('.wpb-grid-row').length > 0)
await page.evaluate(() => {
  const lab = [...document.querySelectorAll('.wpb-view .el-radio-button__inner, .wpb-view label')]
    .find((el) => (el.textContent || '').trim() === '看板')
  if (lab) lab.click()
})
await waitFor(() => !!document.querySelector('.wpr'))
for (const w of [1141, 1392, 1920]) {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false })
  await page.waitForTimeout(1200)
  const m = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.wpb-grid-row')]
    const four = rows.find((r) => r.querySelectorAll('.wpr').length >= 4)
    const pills = [...document.querySelectorAll('.wpr-ins')].slice(0, 2).map((p) => ({
      t: (p.innerText || '').trim(), w: +p.getBoundingClientRect().width.toFixed(1), h: +p.getBoundingClientRect().height.toFixed(1),
    }))
    const blocks = [...rows[0].querySelectorAll('.wpr')].map((r) => +r.getBoundingClientRect().width.toFixed(1))
    return {
      viewport: [window.innerWidth, window.innerHeight],
      rowH: +rows[0].getBoundingClientRect().height.toFixed(1),
      pills, blocks,
      fourTops: four ? [...four.querySelectorAll('.wpr')].map((r) => Math.round(r.getBoundingClientRect().top)) : null,
      fourOpsH: four ? +four.querySelector('.wpb-ops').getBoundingClientRect().height.toFixed(1) : null,
    }
  })
  console.log(w, JSON.stringify(m))
}
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
