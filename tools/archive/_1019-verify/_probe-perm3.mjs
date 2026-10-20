const BASE='http://127.0.0.1:8090'
const lr=await (await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()
const H={Authorization:'Bearer '+lr.data.token}
const roles=(await (await fetch(BASE+'/api/sys/role/list',{headers:H})).json()).data||[]
const role=roles.find(r=>r.roleCode==='user')||roles[0]
const rj=await (await fetch(`${BASE}/api/sys/role/${role.id}/panels`,{headers:H})).json()
const mods=rj.data.modules||[]
const all=mods.flatMap(m=>(m.panels||[]).map(p=>p.panelCode))
console.log('总数', all.length)
const nonYj = all.filter(c=>['DASHBOARD','DC_CONFIG','DC_MONITOR','DC_STATS','BARCODE_SCAN_PICK'].includes(c))
console.log('页面级在矩阵里:', JSON.stringify(nonYj), '=>', nonYj.length)
console.log('推论: yj_panel 在矩阵里 =', all.length - nonYj.length)
for (const m of mods) console.log('  ', m.name, (m.panels||[]).length)
