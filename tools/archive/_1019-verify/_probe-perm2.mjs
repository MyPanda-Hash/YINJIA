const BASE='http://127.0.0.1:8090'
const lr=await (await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()
const H={Authorization:'Bearer '+lr.data.token}
const roles=(await (await fetch(BASE+'/api/sys/role/list',{headers:H})).json()).data||[]
const role=roles.find(r=>r.roleCode==='user')||roles[0]
const rj=await (await fetch(`${BASE}/api/sys/role/${role.id}/panels`,{headers:H})).json()
const codes=new Set((rj.data.modules||[]).flatMap(m=>(m.panels||[]).map(p=>p.panelCode)))
for (const c of ['DASHBOARD','SYS_CONSOLE','SYS_ORG','SYS_USAGE','SYS_BACKUP','DC_CONFIG','DC_MONITOR','DC_STATS','BARCODE_SCAN_PICK']) console.log('  ', c, codes.has(c) ? 'in' : '-')
