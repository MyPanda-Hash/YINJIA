/**
 * 一次性探针(2026-10-14):核对前端「表头字段键」与后端「标签→列」是否对得上 ——
 * 目的是排除"表头填了却被判未填"(键错位)这一类误报。
 * 重点面板:col_name <> label 的(MATERIAL_OUT 正常态 / QC_RECV / QC_INSP / ROUTE / CGD)。
 * 用法: node tools/archive/_probe-fieldkey-1014.mjs [--api http://127.0.0.1:8090/api]
 */
const API = (() => {
  const i = process.argv.indexOf('--api')
  return i >= 0 ? process.argv[i + 1] : 'http://127.0.0.1:8090/api'
})()

const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login?.data?.token
if (!token) { console.error('[FATAL] 登录失败'); process.exit(1) }

for (const pc of ['MATERIAL_OUT', 'QC_RECV', 'QC_INSP', 'ROUTE', 'CGD']) {
  const res = await fetch(`${API}/px/getPanelConfig?panelCode=${pc}`, { headers: { Authorization: 'Bearer ' + token } })
  const j = await res.json()
  const cfg = j?.data || j
  const fields = cfg?.dataSchema?.fields || []
  const names = cfg?.metadata?.panelPageDto?.formPages?.[0]?.fieldNames || ''
  console.log(`\n=== ${pc} (HTTP ${res.status}) 表头字段 ${fields.length} 个 | formPages.fieldNames = ${JSON.stringify(String(names).slice(0, 200))}`)
  for (const f of fields.filter((x) => x.isRequired && !x.hidden)) {
    console.log(`   必填 label=${JSON.stringify(f.label)} name=${JSON.stringify(f.name)} code=${JSON.stringify(f.code)} dataName=${JSON.stringify(f.dataName)} => 前端键=${JSON.stringify(f.code || f.dataName)}`)
  }
  const detailReq = []
  for (const t of cfg?.detail?.tabs || []) for (const f of t.fields || []) if (f.isRequired) detailReq.push(`${f.label}/${f.code || f.dataName}`)
  console.log('   明细必填 =', JSON.stringify(detailReq))
}
