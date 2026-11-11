/* round-05.mjs — 明细分页/首行取证 + 待检验目录截图 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

const shot = async (name) => {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/' + name })
}

const readTable = () => page.evaluate(() => {
  const wrap = document.querySelector('.report-body .el-table') || document.querySelector('.el-table')
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const th = [...document.querySelectorAll('.el-table__header th')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim())
  const rows = bodyRows.slice(0, 3).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
  const pager = [...document.querySelectorAll('.el-pagination')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim())
  const head = (document.querySelector('.report-heading') || {}).innerText || ''
  const links = [...document.querySelectorAll('.doc-no-link')].map((el) => (el.innerText || '').trim())
  return { th, rowCount: bodyRows.length, rows, pager, head: head.replace(/\s+/g, ' '), links: links.slice(0, 8), linkTotal: links.length }
})

console.log('=== QC_INSP_REC_DETAIL ===')
console.log(JSON.stringify(await readTable(), null, 2))
await shot('round-05-detail.png')

// 第二页:验证 50 行一页(翻页按钮)
const paged = await page.evaluate(() => {
  const next = document.querySelector('.el-pagination .btn-next')
  if (!next) return 'no-next'
  next.click()
  return 'ok'
})
await page.waitForTimeout(2500)
const p2 = await readTable()
console.log('=== page2 (翻页后) ===')
console.log(JSON.stringify({ rowCount: p2.rowCount, pager: p2.pager, firstRow: p2.rows[0] }, null, 2))

// 待检验目录
await page.goto('http://localhost:5173/#/panelx/list/QC_CATALOG', { timeout: 30000 })
await page.waitForTimeout(5000)
const cat = await page.evaluate(() => {
  const title = (document.querySelector('.cs-title') || {}).innerText || ''
  const bodyRows = [...document.querySelectorAll('.cs-table tbody tr')]
  const rows = bodyRows.map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
  const statuses = [...document.querySelectorAll('.cs-status-tag')].map((el) => (el.innerText || '').trim())
  const empty = (document.querySelector('.cs-empty') || {}).innerText || ''
  return { title: title.trim(), rowCount: bodyRows.length, statuses: [...new Set(statuses)], empty, rows: rows.slice(0, 3) }
})
console.log('=== QC_CATALOG(待检验目录) ===')
console.log(JSON.stringify(cat, null, 2))
await shot('round-05-catalog.png')
