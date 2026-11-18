const task = await taskSpace(4)
const page = task.page('p1')
await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td.dsr-no')]
  const hit = tds.find((e) => e.textContent.trim() === 'ZC-2026-10-0131')
  if (hit) hit.closest('tr').dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(4500)

const info = await page.evaluate(() => {
  const grid = document.querySelector('.qr-grid')
  const cols = [...grid.querySelectorAll('colgroup col')].map((c) => c.getAttribute('style'))
  const ths = [...grid.querySelectorAll('thead th')].map((th) => ({ t: (th.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 10), w: Math.round(th.getBoundingClientRect().width) }))
  const rows = [...grid.querySelectorAll('tbody tr')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    return tds.slice(0, 5).map((td) => {
      const ta = td.querySelector('textarea, input')
      const val = ta ? (ta.value || '') : (td.innerText || '')
      return { w: Math.round(td.getBoundingClientRect().width), h: Math.round(td.getBoundingClientRect().height), v: val.replace(/\s+/g, ' ').trim().slice(0, 90) }
    })
  })
  return { cols, ths, tableW: Math.round(grid.getBoundingClientRect().width), rows: rows.slice(0, 5) }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-colwidth-20261117/round-13.png' })
