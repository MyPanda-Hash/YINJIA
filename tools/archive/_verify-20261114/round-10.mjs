// round-10 — A2 刷新后重开 SJ-2026-11-0011,值仍在
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}

await page.reload({ timeout: 60000 })
await page.waitForTimeout(8000)
const before = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const trs = [...document.querySelectorAll('.dsr-grid tbody tr')]
  return {
    railRows: trs.length,
    rowNos: trs.slice(0, 5).map((tr) => txt(tr.querySelector('td'))),
    sheet: !!document.querySelector('.fi-grid'),
  }
})
console.log('BEFORE=' + JSON.stringify(before))

const clicked = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('SJ-2026-11-0011'))
  if (!tr) return { ok: false, rowNos: [...document.querySelectorAll('.dsr-grid tbody tr')].map((x) => txt(x.querySelector('td'))).slice(0, 6) }
  tr.click()
  return { ok: true }
})
console.log('CLICK=' + JSON.stringify(clicked))
await page.waitForTimeout(8000)
const reopened = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.sample-row')]
  const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => txt(e))
  const ciOf = (kw) => cols.findIndex((c) => (c || '').includes(kw))
  const v = (ri, ci) => { const td = rows[ri] && rows[ri].querySelectorAll('td')[ci]; if (!td) return null; const el = td.querySelector('input,textarea'); return el ? el.value : txt(td) }
  const active = document.querySelector('.dsr-grid tbody tr.active')
  return {
    sheet: !!document.querySelector('.fi-grid'),
    editing: !!document.querySelector('.fi-sheet.is-editing'),
    activeRow: txt(active),
    gzY: document.querySelectorAll('.sample-row td.gz-y').length,
    v3outer: v(2, ciOf('外径')),
    v5drop: v(4, ciOf('跌落')),
    v7press: v(6, ciOf('挤压')),
    v3outerLabel: cols[ciOf('外径')],
  }
})
console.log('REOPENED=' + JSON.stringify(reopened))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-10-reopened.png', fullPage: true })
console.log('DONE round-10')
