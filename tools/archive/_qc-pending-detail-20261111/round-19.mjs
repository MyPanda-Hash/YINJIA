/* round-19.mjs — 列序/行号改动复核:物料名称+物料批次打头,行号只有一个 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 60000 })
await page.waitForTimeout(7000)
// 勾上「显示全部状态」,让表格有数据可看列序(默认只有 2 条已完成)
await page.evaluate(() => {
  const cb = document.querySelector('.gated-toggle input[type=checkbox]') || document.querySelector('.gated-toggle')
  if (cb) cb.click()
})
await page.waitForTimeout(4000)

const out = await page.evaluate(() => {
  const th = [...document.querySelectorAll('.el-table__header th')]
    .map((el) => (el.innerText || '').replace(/[\s⇅]+/g, ' ').trim())
    .filter(Boolean)
  const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3).map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
  const queryLabels = [...document.querySelectorAll('.fields.udl-fields label')].map((el) => (el.textContent || '').trim())
  return { th, rows, queryLabels }
})
console.log(JSON.stringify(out, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-19-cols.png' })
