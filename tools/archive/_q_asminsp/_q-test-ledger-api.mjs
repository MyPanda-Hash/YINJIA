/* 一次性探针:测试账套(YJ_TEST)下 QC_ASM_INSP 的取数/保存协议摸底。 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
console.log('登录 factory =', login.data?.user?.factory)
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const post = async (u, b) => (await fetch(`${BASE}${u}`, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json()))
const list = await post('/api/px/queryFormDataList', { panelCode: 'QC_ASM_INSP', condition: {}, pageNo: 1, pageSize: 5 })
console.log('code =', list.code, ' total =', list.data?.total ?? list.data?.totalCount)
const rows = list.data?.rows || list.data?.list || list.data?.records || []
console.log('首行键 =', rows[0] ? Object.keys(rows[0]).join(',') : '(无行)')
console.log('首行 =', JSON.stringify(rows[0] || {}).slice(0, 400))
console.log('data 顶层键 =', Object.keys(list.data || {}).join(','))
if (list.data?.detail !== undefined) console.log('detail =', JSON.stringify(list.data.detail).slice(0, 500))
