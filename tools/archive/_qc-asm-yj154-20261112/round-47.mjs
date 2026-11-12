// round-47:强制刷新后再验表观单(排除 SPA 未重载导致的旧数据)
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(1500)
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 30000 })
await page.evaluate(() => location.reload())
await page.waitForTimeout(8000)
const probe = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const sheet = q('.qr-sheet')
  const rows = sheet ? [...sheet.querySelectorAll('.qr-grid tbody tr')] : []
  return {
    factory: txt(q('[class*="factory"]')),
    title: txt(q('.qr-title')),
    formNo: txt(q('.qr-formno')),
    head: sheet ? [...sheet.querySelectorAll('.qr-head-table tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())) : [],
    rows: rows.length,
    firstRows: rows.slice(0, 2).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8)),
    foot: sheet ? [...sheet.querySelectorAll('.qr-foot-table tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())) : [],
  }
})
console.log('AFTER_RELOAD=' + JSON.stringify(await probe()))
