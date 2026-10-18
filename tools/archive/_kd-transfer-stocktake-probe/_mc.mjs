const base='http://127.0.0.1:8090/api'
const lg=await (await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()
const h={'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+lg.data.token}
const post=async(p,b)=>{const r=await fetch(base+p,{method:'POST',headers:h,body:JSON.stringify(b||{})});return {status:r.status, body:(await r.text()).slice(0,300)}}
console.log('== 取消前状态 ==')
console.log((await (await fetch(base+'/api/stock/monthClose/status'||'/stock/monthClose/status',{headers:h})).text()).slice(0,300))
