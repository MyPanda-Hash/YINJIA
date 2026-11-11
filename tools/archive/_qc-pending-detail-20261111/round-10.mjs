/* round-10.mjs — 翻到末页找「已完成检验」的行,验行内「取消完成」渲染 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 30000 })
await page.waitForTimeout(4000)

const goLast = async () => {
  const r = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('span, button, .el-button, i')]
    const last = cands.find((el) => (el.textContent || '').trim() === '▷')
    if (last) { last.click(); return 'last' }
    const next = cands.find((el) => (el.textContent || '').trim() === '▶')
    if (next) { next.click(); return 'next' }
    return 'none'
  })
  await page.waitForTimeout(2500)
  return r
}
console.log('page3 click ->', await goLast())

const scan = await page.evaluate(() => {
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const out = bodyRows.map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    const cell = (i) => (tds[i] ? (tds[i].innerText || '').replace(/\s+/g, ' ').trim() : '')
    return {
      rec: cell(2), insp: cell(3), inspLine: cell(4), status: cell(5), ok: cell(6),
      order: cell(16), orderLine: cell(17), recv: cell(18), recvLine: cell(19), pin: cell(20), pinLine: cell(21),
      op: cell(22),
    }
  })
  const txt = (document.querySelector('.report-body') || document.body).innerText.replace(/\s+/g, ' ')
  const m = txt.match(/第\s*(\d+)\s*\/\s*(\d+)\s*页/)
  return { page: m ? m[1] + '/' + m[2] : '', rows: out, done: out.filter((r) => r.status === '已完成检验') }
})
console.log('page text ->', scan.page)
console.log('rows with 已完成检验 ->', JSON.stringify(scan.done, null, 2))
console.log('sample rows (last 5) ->', JSON.stringify(scan.rows.slice(-5), null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-10-lastpage.png' })
