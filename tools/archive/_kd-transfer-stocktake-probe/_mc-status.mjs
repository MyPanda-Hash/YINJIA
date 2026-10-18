const base='http://127.0.0.1:8090/api'
const lg=await (await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()
const h={'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+lg.data.token}
const st=await (await fetch(base+'/stock/monthClose/status',{headers:h})).json()
console.log('状态: ' + JSON.stringify(st.data).slice(0,400))
