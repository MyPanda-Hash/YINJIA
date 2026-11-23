const task = await taskSpace('shipinsp-wrap-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 40000 })
await page.waitForTimeout(4000)
const rows = await page.evaluate(() => [...document.querySelectorAll('tr')].filter((tr) => /ZJ-\d{4}/.test(tr.innerText || '')).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 10))
console.log('ROWS:', JSON.stringify(rows, null, 1))
const clicked = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((tr) => /ZJ-2026-10-0135/.test(tr.innerText || ''))
  if (!tr) return 'not found'
  tr.click()
  return true
})
console.log('CLICKED:', clicked)
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const cells = [...document.querySelectorAll('.qr-grid tbody td.c-item')]
  return {
    hash: location.hash,
    sheet: !!document.querySelector('.qr-sheet'),
    cols: [...document.querySelectorAll('.qr-grid colgroup col')].map((c) => c.style.width),
    gridW: Math.round(document.querySelector('.qr-grid')?.getBoundingClientRect().width || 0),
    itemCells: cells.map((td) => {
      const r = td.getBoundingClientRect()
      const inp = td.querySelector('input,textarea')
      return {
        text: txt(td), w: Math.round(r.width), h: Math.round(r.height),
        tag: inp ? inp.tagName : null,
        inpW: inp ? Math.round(inp.getBoundingClientRect().width) : null,
        scrollW: inp ? inp.scrollWidth : null,
        clientW: inp ? inp.clientWidth : null,
        value: inp ? inp.value : null,
      }
    }),
  }
})
console.log(JSON.stringify(info, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
const box = await page.evaluate(() => {
  const el = document.querySelector('.qr-grid-scroll')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
})
console.log('BOX:', JSON.stringify(box))
await page.screenshot({ path: 'C:/Users/vigna/ego/shipinsp-wrap-20261123/s3-asm-before.png' })
if (box) await page.screenshot({ path: 'C:/Users/vigna/ego/shipinsp-wrap-20261123/s3b-asm-before-clip.png', clip: box })
