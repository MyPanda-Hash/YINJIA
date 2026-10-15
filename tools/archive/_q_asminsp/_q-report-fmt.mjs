const BASE='http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ'})}).then(r=>r.json())
const H={Authorization:'Bearer '+login.data.token}
for (const [code,panel,doc] of [['qc_asm_insp','QC_ASM_INSP','ZJ-2026-10-0008'],['qc_proc_insp','QC_PROC_INSP','ZC-2026-10-0020'],['so_order','SO_ORDER','']]) {
  if (!doc) continue
  for (const fmt of ['xlsx']) {
    const res = await fetch(`${BASE}/api/report/export?code=${code}&panelCode=${panel}&docNo=${doc}&format=${fmt}`,{headers:H})
    const b = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0)
    console.log(`${code} ${fmt}: HTTP ${res.status} ${b.length} bytes ${res.ok?'':JSON.stringify((await res.text()).slice(0,150))}`)
  }
}
