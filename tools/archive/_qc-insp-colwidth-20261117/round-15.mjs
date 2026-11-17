const task = await taskSpace(4)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 45000 })
await page.waitForTimeout(6000)

// 找一张有明细的单
const info0 = await page.evaluate(() => ({ rows: document.querySelectorAll('td.dsr-no').length, head: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200) }))
let best = null
for (let i = 0; i < Math.min(info0.rows, 8); i++) {
  const doc = await page.evaluate((idx) => {
    const tds = [...document.querySelectorAll('td.dsr-no')]
    if (!tds[idx]) return null
    tds[idx].closest('tr').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return tds[idx].textContent.trim()
  }, i)
  if (!doc) break
  await page.waitForTimeout(2600)
  const m = await page.evaluate(() => {
    const grid = document.querySelector('.qr-grid')
    const trs = [...grid.querySelectorAll('tbody tr')]
    const filled = trs.filter((tr) => {
      const tds = [...tr.querySelectorAll('td')]
      return tds.slice(0, 3).some((td) => {
        const ta = td.querySelector('textarea, input')
        return ((ta ? ta.value : td.innerText) || '').trim().length > 1
      })
    }).length
    return { trs: trs.length, filled, cols: [...grid.querySelectorAll('colgroup col')].map((c) => c.getAttribute('style')) }
  })
  if (!best || m.filled > best.filled) best = { i, doc, ...m }
  if (m.filled >= 3) break
}
console.log(JSON.stringify({ info0, best }, null, 2))

const final = await page.evaluate(() => {
  const grid = document.querySelector('.qr-grid')
  return {
    cols: [...grid.querySelectorAll('colgroup col')].map((c) => c.getAttribute('style')),
    ths: [...grid.querySelectorAll('thead th')].map((th) => ({ t: (th.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12), w: Math.round(th.getBoundingClientRect().width) })),
    tableW: Math.round(grid.getBoundingClientRect().width),
    title: (document.querySelector('.qr-title')?.textContent || '').trim(),
    formno: (document.querySelector('.qr-formno')?.textContent || '').trim(),
  }
})
console.log(JSON.stringify(final, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-colwidth-20261117/round-15-asm.png' })
