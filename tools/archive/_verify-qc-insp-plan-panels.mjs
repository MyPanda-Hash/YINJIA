/*
 * _verify-qc-insp-plan-panels.mjs — 「检验项目维护」按钮下发面核查(2026-10-09,一次性探针)
 *
 * 断言:三类工序检验单(QC_MOLD_INSP/QC_CUT_INSP/QC_ASM_INSP)的「更多」组里有「检验项目维护」,
 *       而来料检验单(QC_INSP)与其它单据**没有**(入口只给这三张单)。
 * 用法: node tools/archive/_verify-qc-insp-plan-panels.mjs http://127.0.0.1:8090
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const ACTION = '检验项目维护'
const WANT = ['QC_MOLD_INSP', 'QC_CUT_INSP', 'QC_ASM_INSP']
const NOTWANT = ['QC_INSP', 'QC_RETURN', 'MANU_ORDER']

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const token = login.data?.token
if (!token) { console.error('登录失败'); process.exit(1) }

for (const pc of [...WANT, ...NOTWANT]) {
  const cfg = await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${pc}`, { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json())
  const groups = cfg?.data?.metadata?.buttonGroups || []
  const hit = groups.filter((g) => (g.actions || []).includes(ACTION))
  const gname = hit.length ? hit.map((g) => g.name).join(',') : '-'
  if (WANT.includes(pc)) ok(`${pc} 有「${ACTION}」(${gname} 组)`, hit.length === 1, JSON.stringify(groups.map((g) => g.name)))
  else ok(`${pc} 没有该入口(只给三类工序检验单)`, hit.length === 0, JSON.stringify(hit.map((g) => g.name)))
  if (WANT.includes(pc)) console.log(`      ${pc} 「${hit[0]?.name}」组动作: ${(hit[0]?.actions || []).join(' | ')}`)
}

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
