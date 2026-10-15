const BASE='http://127.0.0.1:8090'
const L=await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ'})}).then(r=>r.json())
const cfg=(await fetch(`${BASE}/api/px/getPanelConfig?panelCode=QC_ASM_INSP`,{headers:{Authorization:'Bearer '+L.data.token}}).then(r=>r.json())).data
const fs=(cfg.detail?.tabs?.[0]?.fields)||[]
console.log('明细字段默认值:')
for (const f of fs) console.log(`  ${f.dataName} | type=${f.dataType} | default=${JSON.stringify(f.defaultValue)} | computed=${!!f.computed}`)
