const task = await taskSpace('shipinsp-wrap-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 40000 })
await page.waitForTimeout(4000)
// 切到「已完成」页签
const tab = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').trim() === '已完成')
  if (!els.length) return 'no tab'
  els[els.length - 1].click()
  return 'clicked'
})
console.log('TAB:', tab)
await page.waitForTimeout(3000)
const rows = await page.evaluate(() => [...document.querySelectorAll('tr')].filter((tr) => /ZJ-\d{4}/.test(tr.innerText || '')).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('ROWS:', JSON.stringify(rows))
const open = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((t) => (t.innerText || '').includes('ZJ-2026-10-0135'))
  if (!tr) return 'not found'
  tr.click()
  return 'clicked'
})
console.log('OPEN:', open)
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const cells = [...document.querySelectorAll('.qr-grid tbody td.c-item')]
  return {
    docNo: txt(document.querySelector('.qr-sheet .qr-head-table')) .slice(0, 200),
    cols: [...document.querySelectorAll('.qr-grid colgroup col')].map((c) => c.style.width),
    gridW: Math.round(document.querySelector('.qr-grid')?.getBoundingClientRect().width || 0),
    rows: cells.map((td) => {
      const r = td.getBoundingClientRect()
      const inp = td.querySelector('input,textarea')
      return {
        text: txt(td), w: Math.round(r.width), h: Math.round(r.height),
        tag: inp ? inp.tagName : null,
        inpW: inp ? Math.round(inp.getBoundingClientRect().width) : null,
        scrollW: inp ? inp.scrollWidth : null,
        clientW: inp ? inp.clientWidth : null,
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
await page.screenshot({ path: 'C:/Users/vigna/ego/shipinsp-wrap-20261123/s3-asm-before.png' })
