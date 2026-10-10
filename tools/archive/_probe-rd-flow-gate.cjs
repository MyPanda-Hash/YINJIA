/* TEMP probe (2026-10-09): verify the restarted backend exposes the new rdFlowState keys
   canGradeProject / approver / approverName, and that the once-only gates are reflected.
   Usage: node tools/archive/_probe-rd-flow-gate.cjs [user] [factory] [docNo] */
const API = 'http://127.0.0.1:8090/api'

async function login(userName, factory) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password: '123456', factory }),
  })
  const j = await r.json()
  if (j?.code !== 200) throw new Error(`login ${userName}: ${JSON.stringify(j)}`)
  return j.data
}

async function main() {
  const user = process.argv[2] || 'cp'
  const factory = process.argv[3] || 'HSDZ_MES'
  const docNo = process.argv[4] || '__none__'
  const d = await login(user, factory)
  console.log(`user=${d.user.realName} isAdmin=${d.user.isAdmin} factory=${factory}`)
  const r = await fetch(`${API}/px/rdFlow/state?docNo=${encodeURIComponent(docNo)}`, {
    headers: { Authorization: `Bearer ${d.token}` },
  })
  const j = await r.json()
  console.log(`HTTP=${r.status} code=${j?.code}`)
  const keys = ['status', 'level', 'liaison', 'liaisonName', 'owner', 'ownerName',
    'approver', 'approverName', 'canGradeProject', 'canDispatchLiaison', 'canConfirmOwner']
  for (const k of keys) console.log(`  ${k} = ${JSON.stringify(j?.data?.[k])}`)
  const missing = keys.filter((k) => !(k in (j?.data || {})))
  console.log(`MISSING_KEYS=${JSON.stringify(missing)}`)
  console.log(missing.length === 0 ? 'RESULT=OK 新后端已生效' : 'RESULT=FAIL 仍是旧后端')
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
