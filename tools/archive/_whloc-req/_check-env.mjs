const B='http://127.0.0.1:8090'
const t=(await (await fetch(B+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()).data.token
const r=await (await fetch(B+'/api/locale/dict?locale=en',{headers:{Authorization:'Bearer '+t}})).json()
const d=r.data||{}
console.log('  locale=dict 词条数 =', Object.keys(d).length, Object.keys(d).length>0?'✓ .env 已注入':'★ 空(未注入 .env)')