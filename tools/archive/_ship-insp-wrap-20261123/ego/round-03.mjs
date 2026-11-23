const task = await taskSpace('shipinsp-wrap-20261123')
const page = task.page('p1')
const out = []
for (const code of ['ZC-2026-11-0007', 'ZC-2026-11-0005', 'ZC-2026-11-0002', 'ZC-2026-11-0001', 'ZC-2026-10-0131', 'ZC-2026-10-0130', 'ZC-2026-10-0129', 'ZC-2026-10-0128']) {
  await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
  await page.waitForTimeout(2500)
  const clicked = await page.evaluate((c) => {
    const rows = [...document.querySelectorAll('tr')].filter((tr) => (tr.innerText || '').includes(c))
    if (!rows.length) return 'no rows'
    rows[0].click()
    return true
  }, code)
  await page.waitForTimeout(2500)
  const info = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.qr-grid tbody td.c-item')]
    return {
      n: cells.length,
      items: cells.map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 12),
    }
  })
  out.push({ code, clicked, ...info })
  if (info.n) break
}
console.log(JSON.stringify(out, null, 2))
