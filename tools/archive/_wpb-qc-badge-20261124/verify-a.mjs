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
await page.waitForTimeout(800)

const state = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const cs = (el, p) => (el ? getComputedStyle(el)[p] : null)
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const first = rows[0]
  const pill = first.querySelector('.wpr-ins')
  const rowPill = first.querySelector('.wpb-qc')
  // 四道工序的行:确认没被撑成两排
  const four = rows.find((r) => r.querySelectorAll('.wpr').length >= 4)
  const ops4 = four?.querySelector('.wpb-ops')
  return {
    doc: [document.documentElement.clientWidth, document.documentElement.scrollHeight],
    viewport: [window.innerWidth, window.innerHeight],
    pill: {
      text: txt(pill),
      fontSize: cs(pill, 'fontSize'),
      lineHeight: cs(pill, 'lineHeight'),
      borderRadius: cs(pill, 'borderRadius'),
      padding: cs(pill, 'padding'),
      bg: cs(pill, 'backgroundColor'),
      color: cs(pill, 'color'),
      box: pill.getBoundingClientRect().toJSON(),
    },
    rowPill: {
      text: txt(rowPill),
      fontSize: cs(rowPill, 'fontSize'),
      lineHeight: cs(rowPill, 'lineHeight'),
      borderRadius: cs(rowPill, 'borderRadius'),
      bg: cs(rowPill, 'backgroundColor'),
      color: cs(rowPill, 'color'),
    },
    rowHeight: first.getBoundingClientRect().height,
    fourStepRow: four
      ? { no: txt(four.querySelector('.wpb-no')), opsH: ops4.getBoundingClientRect().height, ringTops: [...four.querySelectorAll('.wpr')].map((r) => Math.round(r.getBoundingClientRect().top)) }
      : null,
    legend: txt(document.querySelector('.wpb-legend')),
    hint: txt(first.querySelector('.wpb-qc-hint')),
    hasFlag: !!document.querySelector('.wpr-flag'),
    hasWaitingClass: !!document.querySelector('.wpr.is-waiting'),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wpb-qc-preview-20261124/after-a-full.png', fullPage: true })
