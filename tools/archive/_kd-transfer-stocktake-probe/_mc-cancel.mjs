const base='http://127.0.0.1:8090/api'
const lg=await (await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()
const h={'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+lg.data.token}
const r=await (await fetch(base+'/stock/monthClose/run',{method:'POST',headers:h,body:JSON.stringify({action:'cancel',period:'2026-09'})})).json()
console.log('取消月结: ' + JSON.stringify(r).slice(0,400))
