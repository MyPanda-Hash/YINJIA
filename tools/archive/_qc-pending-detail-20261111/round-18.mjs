/* round-18.mjs — 视图关联修正后复核:8090(正式库)默认应显示 3 条「已完成检验」 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 60000 })
await page.waitForTimeout(9000)

const out = await page.evaluate(() => {
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
  const m = txt.match(/共\s*(\d+)\s*条/)
  const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].map((tr) => {
    const td = [...tr.querySelectorAll('td')]
    const c = (i) => (td[i] ? (td[i].innerText || '').replace(/\s+/g, ' ').trim() : '')
    return { rec: c(2), insp: c(3), status: c(5), ok: c(6), op: c(22) }
  })
  return { total: m ? Number(m[1]) : null, rows, gatedChecked: !!document.querySelector('.gated-toggle.is-checked') }
})
console.log('8090 默认态 ->', JSON.stringify(out, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-18-8090-3rows.png' })
