/* round-07.mjs — 同 round-06,容错旧钩子:只看 switch 面板后的请求 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.evaluate(() => { window.__log = [] })

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => { window.__log = [] })
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 30000 })
await page.waitForTimeout(4500)

const out = await page.evaluate(() => {
  const log = (window.__log || []).map((x) => ({ status: x.status, total: x.total, resp: (x.resp || '').slice(0, 160), body: (x.body || '').slice(0, 240) }))
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const pager = [...document.querySelectorAll('.el-pagination')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim())
  return { log, rowCount: bodyRows.length, pager, hash: location.hash }
})
console.log(JSON.stringify(out, null, 2))
