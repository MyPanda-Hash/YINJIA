const task = await taskSpace(4)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 45000 })
await page.waitForTimeout(6000)

const clicked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__row')]
  const hit = rows.find((r) => (r.textContent || '').includes('ZC-2026-11-0005'))
  if (!hit) return { ok: false, n: rows.length, sample: rows.slice(0, 8).map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)) }
  hit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true }
})
console.log(JSON.stringify({ clicked }, null, 2))
await page.waitForTimeout(6000)

const info = await page.evaluate(() => {
  const grid = document.querySelector('.qr-grid')
  if (!grid) return { grid: false }
  const cols = [...grid.querySelectorAll('colgroup col')].map((c) => c.getAttribute('style'))
  const ths = [...grid.querySelectorAll('thead th')].map((th) => ({
    t: (th.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12),
    w: Math.round(th.getBoundingClientRect().width),
  }))
  const bodyRows = [...grid.querySelectorAll('tbody tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120))
  return {
    grid: true,
    tableW: Math.round(grid.getBoundingClientRect().width),
    cols,
    ths,
    rowCount: bodyRows.length,
    bodyRows: bodyRows.slice(0, 8),
    docNo: (document.querySelector('.qr-head-table')?.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-colwidth-20261117/round-09.png' })
