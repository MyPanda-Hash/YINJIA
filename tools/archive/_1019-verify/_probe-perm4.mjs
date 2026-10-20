import fs from 'node:fs'
const txt = fs.readFileSync('D:/YINJIA-main/tools/archive/_1019-questions/out43.txt','utf8')
const yj = new Set(txt.split('\n').map(l=>l.trim()).filter(l=>/^[A-Z][A-Z0-9_]+$/.test(l)))
const BASE='http://127.0.0.1:8090'
const lr=await (await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()
const H={Authorization:'Bearer '+lr.data.token}
const roles=(await (await fetch(BASE+'/api/sys/role/list',{headers:H})).json()).data||[]
const role=roles.find(r=>r.roleCode==='user')||roles[0]
const rj=await (await fetch(`${BASE}/api/sys/role/${role.id}/panels`,{headers:H})).json()
const all=(rj.data.modules||[]).flatMap(m=>(m.panels||[]).map(p=>p.panelCode))
console.log('yj_panel 库内:', yj.size)
const extra = all.filter(c=>!yj.has(c))
console.log('矩阵有、yj_panel 没有的:', JSON.stringify(extra), extra.length)
const missing = [...yj].filter(c=>!all.includes(c))
console.log('yj_panel 有、矩阵没有的:', JSON.stringify(missing), missing.length)
