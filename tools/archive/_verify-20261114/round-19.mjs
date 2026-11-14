// round-19 — A4 服务端报表(带 Bearer token 直取 /api/report/export)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
console.log('URL=' + await page.url())

const tpl = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const r = await fetch('/api/report/templates?panelCode=QC_FIRST_INSP', { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  return { status: r.status, body: (await r.text()).slice(0, 800) }
})
console.log('TEMPLATES=' + JSON.stringify(tpl))

let code = 'qc_first_insp'
try { const j = JSON.parse(tpl.body); if (j?.data?.[0]?.code) code = j.data[0].code } catch (e) {}
const got = await page.evaluate(async ({ code }) => {
  const token = localStorage.getItem('mes_token')
  const url = `/api/report/export?code=${encodeURIComponent(code)}&panelCode=QC_FIRST_INSP&docNo=SJ-2026-11-0011&format=pdf`
  const r = await fetch(url, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  const buf = new Uint8Array(await r.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192))
  return { status: r.status, ct: r.headers.get('content-type'), cd: r.headers.get('content-disposition'), len: buf.length, b64: btoa(bin) }
}, { code })
console.log('REPORT=' + JSON.stringify({ status: got.status, ct: got.ct, cd: got.cd, len: got.len }))
if (got.status === 200 && got.len > 1000) {
  await fs.writeFile(OUT + '/a4-server-report.pdf', Buffer.from(got.b64, 'base64'))
  console.log('SAVED=' + OUT + '/a4-server-report.pdf')
}
console.log('DONE round-19')
