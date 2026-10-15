const BASE='http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ'})}).then(r=>r.json())
const H={Authorization:'Bearer '+login.data.token}
const res = await fetch(`${BASE}/api/report/export?code=qc_asm_insp&panelCode=QC_ASM_INSP&docNo=ZJ-2026-10-0008&format=pdf`,{headers:H})
console.log('status', res.status)
console.log('body', (await res.text()).slice(0,800))
