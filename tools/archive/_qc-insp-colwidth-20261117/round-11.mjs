const task = await taskSpace(4)
const page = task.page('p1')
const clicked = await page.evaluate(() => {
  const td = [...document.querySelectorAll('td.dsr-no')].find((el) => (el.textContent || '').trim() === 'ZC-2026-11-0005')
  if (!td) return { ok: false, nos: [...document.querySelectorAll('td.dsr-no')].map((e) => e.textContent.trim()).slice(0, 6) }
  const tr = td.closest('tr')
  tr.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true }
})
console.log(JSON.stringify({ clicked }, null, 2))
await page.waitForTimeout(6000)

const info = await page.evaluate(() => {
  const grid = document.querySelector('.qr-grid')
  const cols = [...grid.querySelectorAll('colgroup col')].map((c) => c.getAttribute('style'))
  const ths = [...grid.querySelectorAll('thead th')].map((th) => ({
    t: (th.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12),
    w: Math.round(th.getBoundingClientRect().width),
  }))
  const rows = [...grid.querySelectorAll('tbody tr')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    return tds.slice(0, 5).map((td) => ({ w: Math.round(td.getBoundingClientRect().width), h: Math.round(td.getBoundingClientRect().height), t: (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60) }))
  })
  return { cols, ths, tableW: Math.round(grid.getBoundingClientRect().width), rowCount: rows.length, rows: rows.slice(0, 6) }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-colwidth-20261117/round-11.png' })
