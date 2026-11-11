/* round-08.mjs — 硬刷新后再看一次(确认「首进 0 条」是否可复现) */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.reload({ timeout: 60000 })
await page.waitForTimeout(6000)

const out = await page.evaluate(() => {
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const txt = (document.querySelector('.report-body') || document.body).innerText.replace(/\s+/g, ' ')
  const m = txt.match(/共\s*(\d+)\s*条/)
  const pagerIdx = txt.indexOf('第 ')
  return {
    hash: location.hash,
    rowCount: bodyRows.length,
    total: m ? m[1] : null,
    pagerText: pagerIdx >= 0 ? txt.slice(pagerIdx, pagerIdx + 30) : '',
    firstRow: bodyRows[0] ? [...bodyRows[0].querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()) : [],
  }
})
console.log(JSON.stringify(out, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-08-reload.png' })
