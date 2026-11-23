const task = await taskSpace('shipinsp-wrap-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.waitForTimeout(4000)
const clicked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr')].filter((tr) => /ZC-2026-11-0008/.test(tr.innerText || ''))
  if (!rows.length) return 'no rows'
  rows[0].click()
  return (rows[0].innerText || '').replace(/\s+/g, ' ').trim()
})
console.log('CLICKED:', clicked)
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const cells = [...document.querySelectorAll('.qr-grid tbody td.c-item')]
  const inputs = [...document.querySelectorAll('.qr-grid tbody td.c-item input')]
  const ta = [...document.querySelectorAll('.qr-grid tbody td.c-item textarea')]
  const cols = [...document.querySelectorAll('.qr-grid colgroup col')].map((c) => c.style.width)
  return {
    hash: location.hash,
    sheet: !!document.querySelector('.qr-sheet'),
    sheetText: txt(document.querySelector('.qr-sheet')).slice(0, 1200),
    itemCells: cells.map((td) => {
      const r = td.getBoundingClientRect()
      const inp = td.querySelector('input,textarea')
      return {
        text: txt(td),
        w: Math.round(r.width), h: Math.round(r.height),
        tag: inp ? inp.tagName : null,
        inpW: inp ? Math.round(inp.getBoundingClientRect().width) : null,
        scrollW: inp ? inp.scrollWidth : null,
        clientW: inp ? inp.clientWidth : null,
        value: inp ? inp.value : null,
      }
    }),
    inputs: inputs.length, textareas: ta.length,
    cols,
  }
})
console.log(JSON.stringify(info, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/vigna/ego/shipinsp-wrap-20261123/s2-sheet.png' })
