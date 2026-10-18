const base='http://127.0.0.1:8090/api'
const lg=await (await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()
const h={'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+lg.data.token}
const r=await fetch(base+'/px/queryFormDataList',{method:'POST',headers:h,body:JSON.stringify({panelCode:'TRANSFER',pageNo:1,pageSize:20,condition:{}})})
const j=await r.json()
const rows=(j.data?.list||[]).filter(x=>String(x['单据编号']||'').startsWith('YCD'))
console.log('调拨单接口 -> ' + r.status + ', 金蝶单据 ' + rows.length + ' 张')
rows.slice(0,4).forEach(x=>console.log('  '+x['单据编号']+' '+x['单据日期']+' '+(x['单据状态']||'草稿')))
