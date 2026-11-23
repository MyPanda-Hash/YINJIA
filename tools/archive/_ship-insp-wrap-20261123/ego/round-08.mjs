const task = await taskSpace('shipinsp-wrap-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 40000 })
await page.waitForTimeout(4000)
const tab = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').trim() === '全部')
  if (!els.length) return 'no tab'
  els[els.length - 1].click()
  return 'clicked'
})
console.log('TAB:', tab)
await page.waitForTimeout(2500)
const find = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr')].filter((t) => /ZJ-2026-10-0135/.test(t.innerText || ''))
  return rows.length
})
console.log('FOUND rows:', find)
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
    editableInputs: document.querySelectorAll('.qr-grid tbody textarea').length,
    cols: [...document.querySelectorAll('.qr-grid colgroup col')].map((c) => c.style.width),
    gridW: Math.round(document.querySelector('.qr-grid')?.getBoundingClientRect().width || 0),
    rows: cells.slice(0, 8).map((td) => {
      const r = td.getBoundingClientRect()
      const ta = td.querySelector('textarea')
      const sp = td.querySelector('.qr-cell-text')
      return {
        text: txt(td), w: Math.round(r.width), h: Math.round(r.height),
        tag: ta ? 'textarea' : sp ? 'span' : 'other',
        value: ta ? ta.value : null,
        taH: ta ? Math.round(ta.getBoundingClientRect().height) : null,
        taScrollH: ta ? ta.scrollHeight : null,
        taClientH: ta ? ta.clientHeight : null,
        spanScrollW: sp ? sp.scrollWidth : null,
        spanClientW: sp ? sp.clientWidth : null,
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
await page.screenshot({ path: 'C:/Users/vigna/ego/shipinsp-wrap-20261123/s5-asm-all.png' })
