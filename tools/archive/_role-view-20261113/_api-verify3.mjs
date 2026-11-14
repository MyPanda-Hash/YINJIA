/*
 * _api-verify3.mjs —— 角色模板「套用到另一个角色」正路径(管理员)
 * 用 admin/123456(测试库)把自己的「管理员」角色视图套给「仓库管理(ckgl)」,再用 ckgl 临时账号验结果。
 *
 * 用法: node tools/archive/_role-view-20261113/_api-verify3.mjs [http://127.0.0.1:8091]
 */
import fs from 'node:fs'

const BASE = process.argv[2] || 'http://127.0.0.1:8091'
let pass = 0, fail = 0
const lines = []
const ok = (c, m, extra = '') => {
  if (c) { pass++; console.log(`  ✅ ${m} ${extra}`); lines.push(`✅ ${m} ${extra}`) }
  else { fail++; console.log(`  ❌ ${m} ${extra}`); lines.push(`❌ ${m} ${extra}`) }
}

async function call(method, path, { token, body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* ignore */ }
  return { status: r.status, json, text }
}
async function login(u, p, f = 'YJ_TEST') {
  const r = await call('POST', '/api/auth/login', { body: { userName: u, password: p, factory: f } })
  if (!r.json?.data?.token) throw new Error(`登录失败 ${u}: ${r.status} ${r.text.slice(0, 160)}`)
  return r.json.data.token
}
const detailCols = (cfg) => {
  const pages = cfg?.metadata?.panelPageDto?.tablePages || []
  const cols = []
  for (const p of pages) for (const g of (p.gridTabs || [])) for (const c of (g.columns || [])) if (!cols.includes(c)) cols.push(c)
  return cols
}
async function cfgOf(token, view) {
  const r = await call('GET', `/api/px/getPanelConfig?panelCode=QC_RECV&view=${view}`, { token })
  if (!r.json?.data) throw new Error(`取配置失败: ${r.status}`)
  return r.json.data
}

const main = async () => {
  console.log(`== 角色模板「套用到另一个角色」正路径 @ ${BASE} ==`)
  const admin = await login('admin', '123456')
  const ckgl = await login('zz_fv_b', 'Tmp#FieldView2026')

  // 起点干净:admin 角色与 ckgl 都恢复继承
  await call('POST', '/api/px/resetRoleFieldView', { token: admin, body: { panelCode: 'QC_RECV' } })
  await call('POST', '/api/px/resetRoleFieldView', { token: ckgl, body: { panelCode: 'QC_RECV' } })

  // 1) admin 先照抄系统整体,再隐掉「备注」并把最后一列提到最前
  const cp = await call('POST', '/api/px/copyRoleFieldViewFromSystem', { token: admin, body: { panelCode: 'QC_RECV' } })
  ok(cp.json?.data?.saved > 0, '管理员先「从系统整体复制」', `${cp.json?.data?.saved} 行`)

  const fv = await call('GET', '/api/px/fieldView?panelCode=QC_RECV', { token: admin })
  const rows = fv.json?.data?.detail || []
  const vis = rows.filter((r) => r.shown).map((r) => r.label)
  const last = vis[vis.length - 1]
  const newVis = [last, ...vis.filter((l) => l !== last && l !== '备注')]
  const payload = newVis.map((label, i) => ({ label, visible: true, seq: i + 1 }))
  for (const r of rows) if (!newVis.includes(r.label)) payload.push({ label: r.label, visible: false, seq: null })
  const sv = await call('POST', '/api/px/saveRoleFieldView', { token: admin, body: { panelCode: 'QC_RECV', place: 'detail', columns: payload } })
  ok(sv.json?.data?.saved > 0, '管理员给自己角色排好序(首列=' + last + ',隐掉备注)', `${sv.json?.data?.saved} 行`)

  const adminCols = detailCols(await cfgOf(admin, 'role'))
  ok(adminCols[0] === last && !adminCols.includes('备注'), '管理员角色的视图已生效',
    `首列=${adminCols[0]} / ${adminCols.length} 列`)

  // 2) 套用到 ckgl
  const ap = await call('POST', '/api/px/copyRoleFieldViewToRole', { token: admin, body: { panelCode: 'QC_RECV', roleCode: 'ckgl' } })
  ok(ap.json?.data?.saved > 0, '套用成功', `${ap.json?.data?.saved} 行 → ${ap.json?.data?.to}`)

  // 3) 目标角色的账号登录后,看到的必须是同一套
  const ckglCols = detailCols(await cfgOf(ckgl, 'role'))
  ok(JSON.stringify(ckglCols) === JSON.stringify(adminCols), '目标角色看到与来源角色逐列一致(含顺序)')
  ok(ckglCols[0] === last && !ckglCols.includes('备注'), '目标角色同样:首列=' + last + '、无备注')

  // 4) 目标角色恢复继承后回原样(不残留)
  await call('POST', '/api/px/resetRoleFieldView', { token: ckgl, body: { panelCode: 'QC_RECV' } })
  const base = detailCols(await cfgOf(ckgl, 'system'))
  const back = detailCols(await cfgOf(ckgl, 'role'))
  ok(JSON.stringify(back) === JSON.stringify(base), '恢复继承后回到系统整体')
  await call('POST', '/api/px/resetRoleFieldView', { token: admin, body: { panelCode: 'QC_RECV' } })

  console.log(`\n结果: PASS ${pass} / FAIL ${fail}`)
  lines.push(`\n结果: PASS ${pass} / FAIL ${fail}`)
  fs.writeFileSync('tools/archive/_role-view-20261113/_api-verify3-out.txt', lines.join('\n'), 'utf8')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('中断:', e.message); process.exit(2) })
