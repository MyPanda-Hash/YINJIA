// 只读取证:ROUTE 单据明细行的**值**(判定"预置空行"是否落库存在)
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` }
const list = (await (await fetch(`${BASE}/api/px/queryFormDataList`, {
  method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'ROUTE', pageNo: 1, pageSize: 10, condition: {} }),
})).json())?.data?.list || []
for (const r of list) {
  const items = r.detail?.items || []
  console.log(`编号=${r['编号']} 名称=${r['工艺路线名称']} 状态=${r['单据状态']} 行数=${items.length}`)
  items.forEach((it, i) => console.log('   ', i, JSON.stringify(it)))
}
