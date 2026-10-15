// 一次性探针(2026-10-16):下架「成型检验单 QC_MOLD_INSP / 切炭检验单 QC_CUT_INSP / 成品检验规范 QC_FIN_SPEC」后,
// 对着**现役后端**(默认 8090)复核:三张已下架面板取不到配置(非 200),保留的检验单面板配置与取数仍 200。
// 后端的面板配置读的是库(yj_panel),所以即使跑的是旧 jar,这条探针也能验证「库侧下架」是否干净。
// 用法: node tools/archive/_qc-drop3/_probe-drop-verify.cjs [http://127.0.0.1:8090]
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'

const DROPPED = ['QC_MOLD_INSP', 'QC_CUT_INSP', 'QC_FIN_SPEC']
const KEPT = ['QC_FIRST_INSP', 'QC_PROC_INSP', 'QC_ASM_INSP',
  'QC_BHG', 'QC_BHC', 'QC_BHZ', 'QC_JJF', 'QC_SCP', 'QC_LYB', 'QC_SCY']

const post = async (path, body, token) => {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON 保留原文 */ }
  return { status: res.status, json, text }
}
const get = async (path, token) => {
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 同上 */ }
  return { status: res.status, json, text }
}

let pass = 0, fail = 0
const check = (ok, label, detail) => { ok ? pass++ : fail++; console.log((ok ? '  ✓ ' : '  ✗ ') + label + (detail ? '  ' + detail : '')) }

const main = async () => {
  const login = await post('/auth/login', { userName: 'admin', password: '123456' })
  const token = login.json?.data?.token
  if (!token) { console.log('FAIL 登录失败:' + (login.json?.message || login.text).slice(0, 160)); process.exitCode = 1; return }
  console.log('[登录] ok  ' + API)

  console.log('\n① 已下架 3 张:配置必须取不到')
  for (const pc of DROPPED) {
    const cfg = await get('/px/getPanelConfig?panelCode=' + pc, token)
    const bad = cfg.status !== 200 || cfg.json?.code !== 200 || !cfg.json?.data
    check(bad, pc + ' 取配置被拒', 'HTTP ' + cfg.status + ' / body.code=' + (cfg.json?.code ?? '-') + ' / ' + String(cfg.json?.message || cfg.text).slice(0, 60))
    const q = await post('/px/queryFormDataList', { panelCode: pc, condition: {}, pageNo: 1, pageSize: 3 }, token)
    const qbad = q.status !== 200 || q.json?.code !== 200 || !q.json?.data
    check(qbad, pc + ' 取数被拒', 'HTTP ' + q.status + ' / body.code=' + (q.json?.code ?? '-'))
  }

  console.log('\n② 保留的检验单 10 张:配置与取数都应 200')
  for (const pc of KEPT) {
    const cfg = await get('/px/getPanelConfig?panelCode=' + pc, token)
    check(cfg.status === 200 && cfg.json?.code === 200 && !!cfg.json?.data, pc + ' 配置 200')
    const q = await post('/px/queryFormDataList', { panelCode: pc, condition: {}, pageNo: 1, pageSize: 3 }, token)
    check(q.status === 200 && q.json?.code === 200 && !!q.json?.data, pc + ' 取数 200')
  }

  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`)
  if (fail > 0) process.exitCode = 1
}
main().catch((e) => { console.log('FAIL ' + e.message); process.exitCode = 1 })
