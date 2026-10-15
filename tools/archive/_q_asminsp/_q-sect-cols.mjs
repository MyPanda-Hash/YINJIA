const BASE='http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ'})}).then(r=>r.json())
const H={Authorization:'Bearer '+login.data.token}
const cfg = (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=QC_ASM_INSP`,{headers:H}).then(r=>r.json())).data
const tp = cfg?.metadata?.panelPageDto?.tablePages?.[0]
const gt = tp?.gridTabs || []
console.log('gridTabs 数 =', gt.length)
console.log('gridTabs[0].columns =', JSON.stringify(gt[0]?.columns))
console.log('含 表区 ?', (gt[0]?.columns||[]).includes('表区'))
console.log('detail.tabs =', JSON.stringify((cfg.detail?.tabs||[]).map(t=>({key:t.key,label:t.label,n:(t.fields||[]).length}))))
const f0 = (cfg.detail?.tabs?.[0]?.fields||[]).find(f=>f.dataName==='表区')
console.log('detail.tabs[0] 里的 表区 字段 =', JSON.stringify(f0))
