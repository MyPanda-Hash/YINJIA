// 一次性取证探针(只读):OP 参照源行形状 + ROUTE 单据形状
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
const list = async (panelCode, pageSize = 2) => (await (await fetch(`${BASE}/api/px/queryFormDataList`, {
  method: 'POST', headers: H, body: JSON.stringify({ panelCode, pageNo: 1, pageSize, condition: {} }),
})).json())?.data?.list || []
const cfgOf = async (panelCode) => (await (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${panelCode}`, { headers: H })).json())?.data

for (const pc of ['OP', 'ROUTE']) {
  const cfg = await cfgOf(pc)
  const t0 = cfg?.detail?.tabs?.[0]
  console.log(`\n=== ${pc} ===`)
  console.log('singleDoc =', cfg?.metadata?.singleDoc, '| detail.tabs[0].key =', JSON.stringify(t0?.key),
    '| gridTabs[0].columns =', JSON.stringify(cfg?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns)?.slice(0, 160))
  const rows = await list(pc)
  console.log('list 行数 =', rows.length)
  const r0 = rows[0]
  console.log('行顶层键 =', JSON.stringify(r0 ? Object.keys(r0) : []))
  if (r0?.detail) {
    console.log('  detail 键 =', JSON.stringify(Object.keys(r0.detail)),
      '| 行数 =', JSON.stringify(Object.fromEntries(Object.entries(r0.detail).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v]))))
    for (const [k, v] of Object.entries(r0.detail)) {
      if (Array.isArray(v) && v[0]) console.log(`  detail.${k}[0] 键 =`, JSON.stringify(Object.keys(v[0])))
    }
  }
  const probe = ['工序编码', '工序名称', '工艺路线名称', '编号', '单据状态']
  console.log('  顶层取样 =', JSON.stringify(Object.fromEntries(probe.filter((k) => k in (r0 || {})).map((k) => [k, r0[k]]))))
}
