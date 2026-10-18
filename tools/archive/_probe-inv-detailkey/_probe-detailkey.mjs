/**
 * 探针(只读):档案面板(INV)明细到底住在 detail 的哪个键下 —— 本机 8090 实测。
 * 只读 HTTP;不写库、不改文件。跑法: node tools/archive/_probe-inv-detailkey/_probe-detailkey.mjs [base]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
const lg = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg?.data?.token
if (!token) { console.log('LOGIN FAIL', JSON.stringify(lg).slice(0, 200)); process.exit(1) }

for (const body of [{ panelCode: 'INV', condition: {}, pageNo: 1, pageSize: 1000 },
                    { panelCode: 'INV', condition: { 所属类别: '炭粉' }, pageNo: 1, pageSize: 1000 },
                    { panelCode: 'EMP', condition: {}, pageNo: 1, pageSize: 1000 }]) {
  const res = await (await fetch(`${BASE}/px/queryFormDataList`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })).json()
  const d = res?.data
  const doc = d?.list?.[0]
  const det = doc?.detail || {}
  const keys = Object.entries(det).map(([k, v]) => `${k}${Array.isArray(v) ? `[${v.length}]` : `(${typeof v})`}`)
  console.log(`${body.panelCode} ${JSON.stringify(body.condition)} ⇒ totalSize=${d?.totalSize} list=${d?.list?.length} detail键=${keys.join(',') || '(无)'}`)
  console.log(`   旧逻辑(invRowsOf 写死 detail.items) 拍平行数 = ${(det.items && Array.isArray(det.items)) ? det.items.length : (d?.list?.length || 0)}`)
  const first = Object.values(det).find((v) => Array.isArray(v))?.[0]
  if (first) console.log(`   首行样例: 存货编码=${first['存货编码']} 所属类别=${first['所属类别']} 存货名称=${String(first['存货名称'] ?? '').slice(0, 20)}`)
}
