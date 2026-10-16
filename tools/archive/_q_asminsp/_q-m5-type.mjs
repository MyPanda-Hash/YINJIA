const BASE='http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ_TEST'})}).then(r=>r.json())
const H={'Content-Type':'application/json',Authorization:'Bearer '+login.data.token}
const r = await fetch(`${BASE}/api/px/queryFormDataList`,{method:'POST',headers:H,body:JSON.stringify({panelCode:'QC_ASM_INSP',condition:{},pageNo:1,pageSize:50})}).then(r=>r.json())
const list = r.data.list||[]
console.log('docs =', list.map(x=>x['单据编号']).join(','))
const doc = list.find(x=>x['单据编号']==='ZJ-2026-10-0014')
console.log('detail keys =', Object.keys(doc?.detail||{}))
const items = doc?.detail?.items || []
console.log('items =', items.length)
for (const it of items) console.log('  ', JSON.stringify(it))
