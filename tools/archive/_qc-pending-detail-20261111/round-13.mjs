/* round-13.mjs — 8090(jar 内 static)复核:同一面板/同一版前端已随新 jar 生效 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 60000 })
await page.waitForTimeout(8000)

const out = await page.evaluate(() => {
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const txt = (document.querySelector('.report-body') || document.body).innerText.replace(/\s+/g, ' ')
  const m = txt.match(/共\s*(\d+)\s*条/)
  const pm = txt.match(/第\s*(\d+)\s*\/\s*(\d+)\s*页/)
  const th = [...document.querySelectorAll('.el-table__header th')].map((el) => (el.innerText || '').replace(/[\s⇅]+/g, ' ').trim())
  return {
    hash: location.hash,
    title: document.title,
    total: m ? m[1] : null,
    page: pm ? pm[1] + '/' + pm[2] : '',
    rowCount: bodyRows.length,
    th,
    hasReopenCol: th.includes('操作'),
    links: [...document.querySelectorAll('.doc-no-link')].slice(0, 4).map((el) => (el.innerText || '').trim()),
  }
})
console.log('8090 ->', JSON.stringify(out, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-13-8090.png' })

// 待检验目录(8090)
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_CATALOG', { timeout: 60000 })
await page.waitForTimeout(7000)
const cat = await page.evaluate(() => {
  const title = ((document.querySelector('.cs-title') || {}).innerText || '').trim()
  const rows = [...document.querySelectorAll('.cs-table tbody tr')].length
  const statuses = [...new Set([...document.querySelectorAll('.cs-status-tag')].map((el) => (el.innerText || '').trim()))]
  const acts = [...new Set([...document.querySelectorAll('.cs-act')].map((el) => (el.innerText || '').trim()))]
  return { title, rows, statuses, acts }
})
console.log('8090 catalog ->', JSON.stringify(cat))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-13-8090-catalog.png' })
