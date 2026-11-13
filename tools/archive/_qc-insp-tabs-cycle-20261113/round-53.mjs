// round-53:验收①检测周期只到审批通过(草稿单只显示首次时间)②首件检验单三个页签
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')
const probe = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const sheet = q('.qr-sheet')
  return {
    hash: location.hash,
    title: txt(q('.qr-title')),
    tabs: [...document.querySelectorAll('.dsr-tabs .dsr-tab')].map((b) => ({ t: b.textContent.trim(), on: b.classList.contains('active') })),
    count: txt(q('.dsr-count')),
    head: sheet ? [...sheet.querySelectorAll('.qr-head-table tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())) : [],
    rows: sheet ? sheet.querySelectorAll('.qr-grid tbody tr').length : 0,
  }
})
// ① 首件检验单:三个页签 + 默认未完成
await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(1200)
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 })
await page.evaluate(() => location.reload())
await page.waitForTimeout(8000)
console.log('FIRST_DEFAULT=' + JSON.stringify(await probe()))
for (const t of ['已完成', '全部']) {
  await page.evaluate((label) => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === label)?.click(), t)
  await page.waitForTimeout(2600)
  const p = await probe()
  console.log('FIRST_' + t + '=' + JSON.stringify({ count: p.count, rows: p.rows, tabs: p.tabs }))
}
// ② 出货检验单功能:草稿单只显示首次时间(不再有提交审批的第二段)
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.evaluate(() => location.reload())
await page.waitForTimeout(8000)
const found = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  const hit = rows.find((tr) => (tr.querySelector('td')?.textContent || '').includes('ZC-2026-11-0005'))
  if (hit) { hit.click(); return true }
  return rows.length
})
await page.waitForTimeout(2600)
console.log('CYCLE_DRAFT=' + JSON.stringify({ found, ...(await probe()) }))
