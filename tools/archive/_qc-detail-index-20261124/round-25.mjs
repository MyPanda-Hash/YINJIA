// round-25 — 先看清 DOM:报表表在 .report-body 里,操作列是否存在
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc reopen button verify')
const page = task.page('p1')
console.log('url: ' + await page.url())
if (!(await page.url()).includes('QC_INSP_REC_DETAIL')) {
  await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 180000 })
}
await page.waitForTimeout(9000)
const st = await page.evaluate(() => {
  const body = document.querySelector('.report-body')
  const tbl = body ? body.querySelector('table') : null
  const heads = tbl ? [...tbl.querySelectorAll('thead th')].map((x) => x.innerText.replace(/[\s⇅]+/g, ' ').trim()) : []
  const rows = tbl ? [...tbl.querySelectorAll('tbody tr')] : []
  return {
    url: location.href,
    hasReportBody: !!body,
    tableCount: document.querySelectorAll('table').length,
    heads,
    rowCount: rows.length,
    firstRow: rows[0] ? rows[0].innerText.replace(/\s+/g, ' ').slice(0, 160) : '',
    reopenCells: [...document.querySelectorAll('td .doc-no-link, td .qc-reopen-na')].map((e) => (e.innerText || '').trim()).slice(0, 12),
    opHeader: heads.includes('操作'),
    bodyHead: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260),
  }
})
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: OUT + '/round-25-state.png' })
