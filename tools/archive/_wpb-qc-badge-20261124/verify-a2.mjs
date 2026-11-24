const task = await taskSpace('wpb-qc-preview-20261124')
const page = task.page('p1')
async function waitFor(expr, ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(expr)) return true
    await page.waitForTimeout(600)
  }
  return false
}
async function fit (w, h) {
  const win = await page.cdp('Browser.getWindowForTarget', {})
  if (win && win.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: win.windowId, bounds: { windowState: 'normal' } })
    await task.cdp('Browser.setWindowBounds', { windowId: win.windowId, bounds: { width: w, height: h } })
  }
  await page.waitForTimeout(1200)
}
async function measure (tag) {
  const m = await page.evaluate(() => {
    const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
    const rows = [...document.querySelectorAll('.wpb-grid-row')]
    const four = rows.find((r) => r.querySelectorAll('.wpr').length >= 4)
    const pills = [...document.querySelectorAll('.wpr-ins')].slice(0, 3).map((p) => ({
      t: txt(p), w: +p.getBoundingClientRect().width.toFixed(1), h: +p.getBoundingClientRect().height.toFixed(1),
    }))
    return {
      viewport: [window.innerWidth, window.innerHeight],
      rowH: +document.querySelector('.wpb-grid-row').getBoundingClientRect().height.toFixed(1),
      pillBox: pills,
      fourStep: four
        ? {
          no: txt(four.querySelector('.wpb-no')),
          ringTops: [...four.querySelectorAll('.wpr')].map((r) => Math.round(r.getBoundingClientRect().top)),
          opsH: +four.querySelector('.wpb-ops').getBoundingClientRect().height.toFixed(1),
        }
        : null,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  console.log(tag, JSON.stringify(m))
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

await fit(1141, 820)
await measure('1141')
await page.screenshot({ path: 'C:/Users/vigna/ego/wpb-qc-preview-20261124/after-a-1141.png' })

await fit(1600, 1000)
await measure('1600')
await page.screenshot({ path: 'C:/Users/vigna/ego/wpb-qc-preview-20261124/after-a-1600.png' })
