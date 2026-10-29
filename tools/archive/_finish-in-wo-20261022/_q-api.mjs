const base = 'http://127.0.0.1:8090'
const login = await (await fetch(base + '/api/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({userName:'admin',password:'123456',factory:'YJ'})})).json()
const token = login.data.token
const res = await (await fetch(base + '/api/px/queryFormDataList', {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({panelCode:'FINISH_IN', keyword:'GD-2026-10-0117', condition:{}, pageNo:1, pageSize:10})})).json()
console.log('totalSize =', res.data.totalSize)
for (const r of res.data.list) console.log(r['单据编号'], '|', r['单据日期'], '|', r['加工单号'], '|', r['工单行号'], '|', r['单据状态'])
