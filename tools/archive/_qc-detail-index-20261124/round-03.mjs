// round-03 — 打开「待检验目录」(QC_CATALOG),抓行与行内链接(📄/↗/完成检验)
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
await page.goto(BASE + '/#/panelx/list/QC_CATALOG', { timeout: 90000 })
await page.waitForTimeout(6000)
const info = await page.evaluate(() => {
  const tbls = [...document.querySelectorAll('table')]
  const data = tbls.map((t, i) => ({ i, rows: t.querySelectorAll('tbody tr').length }))
  const bodyTbl = tbls.find((t) => t.querySelectorAll('tbody tr').length > 0)
  const rows = bodyTbl ? [...bodyTbl.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => ({
    text: tr.innerText.replace(/\s+/g, ' ').trim(),
    html: tr.innerHTML.replace(/\s+/g, ' ').slice(0, 1200),
  })) : []
  return { url: location.href, tables: data, rows, bodySnippet: document.body.innerText.replace(/\s+/g, ' ').slice(0, 500) }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: OUT + '/round-03-catalog.png' })
