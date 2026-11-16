// round-48:出货检验表观左栏页签验收(未完成默认 / 已完成 / 全部)
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')
const probe = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const rail = q('.doc-select-rail')
  const rows = rail ? [...rail.querySelectorAll('.dsr-grid tbody tr')] : []
  return {
    tabs: [...document.querySelectorAll('.dsr-tabs .dsr-tab')].map((b) => ({ t: b.textContent.trim(), on: b.classList.contains('active') })),
    count: txt(q('.dsr-count')),
    tagCounts: (rail ? [...rail.querySelectorAll('.dsr-grid tbody .dsr-tag')] : []).reduce((a, el) => { const k = el.textContent.trim(); a[k] = (a[k] || 0) + 1; return a }, {}),
    rows: rows.length,
    railTitle: txt(q('.dsr-head .dsr-title')),
    title: txt(q('.qr-title')),
  }
})
await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(1200)
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 30000 })
await page.evaluate(() => location.reload())
await page.waitForTimeout(8000)
console.log('DEFAULT=' + JSON.stringify(await probe()))
for (const t of ['已完成', '全部']) {
  await page.evaluate((label) => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === label)?.click(), t)
  await page.waitForTimeout(2800)
  console.log(t + '=' + JSON.stringify(await probe()))
}
