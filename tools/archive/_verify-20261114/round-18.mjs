// round-18 — A4 服务端报表:8090 /report/export 直接取 PDF(服务端 Jasper,新 jar)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
console.log('URL=' + await page.url())

// 报表模板清单
const tpl = await page.fetch('/api/report/templates?panelCode=QC_FIRST_INSP', { timeout: 20000 })
console.log('TEMPLATES=' + JSON.stringify({ status: tpl.status, body: (tpl.body || '').slice(0, 600) }))

// 服务端报表 PDF(code 取模板清单里的 code)
let code = 'qc_first_insp'
try {
  const j = JSON.parse(tpl.body)
  if (j?.data?.[0]?.code) code = j.data[0].code
} catch (e) {}
const url = `/report/export?code=${encodeURIComponent(code)}&panelCode=QC_FIRST_INSP&docNo=SJ-2026-11-0011&format=pdf`
const res = await page.fetch(url, { timeout: 60000, saveAs: OUT + '/a4-server-report.pdf' })
console.log('SERVER_PDF=' + JSON.stringify({ status: res.status, ok: res.ok, url, headers: res.headers }))
console.log('DONE round-18')
