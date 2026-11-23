const task = await taskSpace('shipinsp-wrap-20261123')
const page = await task.newPage()
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 40000 })
await page.waitForTimeout(5000)
const tab = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.dsr-tab')].find((e) => (e.textContent || '').trim() === '已完成')
  if (!el) return 'no tab'
  el.click()
  return 'clicked'
})
console.log('TAB:', tab)
await page.waitForTimeout(3000)
let found = false
for (let pageNo = 1; pageNo <= 10 && !found; pageNo++) {
  const state = await page.evaluate(() => {
    const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
    return {
      pager: [...document.querySelectorAll('*')].filter((e) => /共有数据/.test(e.innerText || '') && e.children.length === 0).map((e) => (e.innerText || '').trim())[0],
      pageNo: txt(document.querySelector('.dsr-pager .page-no, .page-no, .as-side-pager .page-no')),
      has: [...document.querySelectorAll('tr')].some((t) => (t.innerText || '').includes('ZJ-2026-10-0135')),
      firstRow: [...document.querySelectorAll('tr')].filter((t) => /ZJ-\d{4}/.test(t.innerText || '')).map((t) => txt(t).slice(0, 26)).slice(0, 3),
    }
  })
  console.log('page', pageNo, JSON.stringify(state))
  if (state.has) { found = true; break }
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, .page-btn, .dsr-pager *')].find((e) => (e.textContent || '').trim() === '▶' && e.offsetParent)
    if (!btn) return 'no next'
    btn.click()
    return 'next'
  })
  console.log('  next:', clicked)
  await page.waitForTimeout(2500)
}
console.log('found:', found)
if (found) {
  await page.evaluate(() => {
    const tr = [...document.querySelectorAll('tr')].find((t) => (t.innerText || '').includes('ZJ-2026-10-0135'))
    tr.click()
  })
  await page.waitForTimeout(4500)
  const info = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.qr-grid tbody td.c-item')]
    const td = cells.find((c) => (c.textContent || '').replace(/\s+/g, '').includes('内PP棉'))
    if (!td) return { found: false, n: cells.length, all: cells.map((c) => (c.innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 12) }
    const sp = td.querySelector('.qr-cell-text')
    const r = td.getBoundingClientRect()
    return {
      found: true, text: (td.innerText || '').replace(/\s+/g, ' ').trim(),
      tdW: Math.round(r.width), tdH: Math.round(r.height),
      overflow: sp ? sp.scrollWidth > sp.clientWidth + 1 : null,
      whiteSpace: sp ? getComputedStyle(sp).whiteSpace : null,
    }
  })
  console.log('ASM:', JSON.stringify(info, null, 1))
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) {}
  await page.waitForTimeout(500)
  const b = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.qr-grid tbody td.c-item')]
    const td = cells.find((c) => (c.textContent || '').replace(/\s+/g, '').includes('内PP棉'))
    if (!td) return null
    td.closest('tr').scrollIntoView({ block: 'center' })
    return null
  })
  await page.waitForTimeout(700)
  const clip = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.qr-grid tbody td.c-item')]
    const td = cells.find((c) => (c.textContent || '').replace(/\s+/g, '').includes('内PP棉'))
    if (!td) return null
    const r = td.closest('tr').getBoundingClientRect()
    return { x: Math.max(0, Math.round(r.x) - 2), y: Math.max(0, Math.round(r.y) - 2), width: Math.round(Math.min(r.width + 4, window.innerWidth - 4)), height: Math.round(Math.min(r.height + 4, window.innerHeight - 4)) }
  })
  if (clip) await page.screenshot({ path: 'C:/Users/vigna/ego/shipinsp-wrap-20261123/p2-asm-item-wrap.png', clip })
  else await page.screenshot({ path: 'C:/Users/vigna/ego/shipinsp-wrap-20261123/p2-asm-sheet.png' })
  console.log('clip:', JSON.stringify(clip))
}
