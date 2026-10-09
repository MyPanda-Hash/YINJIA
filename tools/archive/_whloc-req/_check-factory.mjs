const B='http://127.0.0.1:8090'
const r=await (await fetch(B+'/api/base/factory/list')).json()
console.log('工厂清单:', JSON.stringify(r.data ?? r, null, 1))
for (const f of (r.data||[])) {
  const lg=await (await fetch(B+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:f.code})})).json()
  console.log(`  factory=${f.code} (${f.name}) -> 登录 ${lg.code===200?'OK':'失败'}  令牌工厂声明=${lg.data?.user?.factory}`)
}