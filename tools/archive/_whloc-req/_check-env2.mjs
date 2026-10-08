const B='http://127.0.0.1:8090'
const t=(await (await fetch(B+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()).data.token
for (const u of ['/api/locale/dict','/api/locale/dict?locale=en','/api/locale/list']) {
  try { const r=await (await fetch(B+u,{headers:{Authorization:'Bearer '+t}})).json()
    console.log(' ', u, '-> code=', r.code, ' data类型=', Array.isArray(r.data)?'array('+r.data.length+')':typeof r.data, ' keys=', r.data&&!Array.isArray(r.data)?Object.keys(r.data).slice(0,8).join(','):'') }
  catch(e){ console.log(' ', u, '-> 失败', e.message) }
}