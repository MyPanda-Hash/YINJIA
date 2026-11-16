// round-34 — 巡线只读态:测试单置审核人后纸面转只读(lead 额外项)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(8000)
const rail = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return { rows: [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 4).map((x) => txt(x)) }
})
console.log('RAIL=' + JSON.stringify(rail))
const open = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('XJ-2026-11-0001'))
  if (tr) tr.click()
  return !!tr
})
console.log('OPEN=' + open)
await page.waitForTimeout(8000)
const st = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const active = document.querySelector('.dsr-grid tbody tr.active')
  return {
    activeRow: txt(active),
    editing: !!document.querySelector('.lp-sheet.is-editing'),
    inputs: document.querySelectorAll('.lp-grid input').length,
    activeTag: txt(document.querySelector('.dsr-grid tbody tr.active .dsr-tag')),
    cellText: txt(document.querySelector('.lp-block[data-lp="巡线时间"]')),
    v1: txt(document.querySelector('.lp-prod[data-lp="编号1"]')),
    vLen: txt(document.querySelector('.lp-prod[data-lp="长度实测1"]')),
    rowspan4: [...document.querySelectorAll('[rowspan="4"]')].length,
    headers: [...document.querySelectorAll('.lp-grid thead th')].length,
    sideHasSave: [...document.querySelectorAll('.as-side-btn')].some((e) => txt(e) === '保存'),
  }
})
console.log('READONLY=' + JSON.stringify(st, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-34-patrol-readonly.png', fullPage: true })
await fs.writeFile(OUT + '/b-readonly.json', JSON.stringify({ rail, open, st }, null, 1), 'utf8')
console.log('DONE round-34')
