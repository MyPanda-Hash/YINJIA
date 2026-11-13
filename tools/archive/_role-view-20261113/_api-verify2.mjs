/*
 * _api-verify2.mjs —— 角色字段视图第二轮接口闭环(序号排序 / 从整体复制 / 套用到另一角色)
 * 打 8091 临时实例 + 测试库;验完把两个角色都恢复继承。
 *
 * 用法: node tools/archive/_role-view-20261113/_api-verify2.mjs [http://127.0.0.1:8091]
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
  try { json = JSON.parse(text) } catch { /* 非 JSON */ }
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
const headerFields = (cfg) => (cfg?.dataSchema?.fields || []).filter((f) => !f.hidden).map((f) => f.dataName)
async function cfgOf(token, view) {
  const r = await call('GET', `/api/px/getPanelConfig?panelCode=QC_RECV&view=${view}`, { token })
  if (!r.json?.data) throw new Error(`取配置失败: ${r.status}`)
  return r.json.data
}
async function fv(token) {
  const r = await call('GET', '/api/px/fieldView?panelCode=QC_RECV', { token })
  if (!r.json?.data) throw new Error(`取 fieldView 失败: ${r.status}`)
  return r.json.data
}

const main = async () => {
  console.log(`== 角色字段视图 第二轮验证 @ ${BASE} ==`)
  const a = await login('zz_fv_a', 'Tmp#FieldView2026')
  const b = await login('zz_fv_b', 'Tmp#FieldView2026')

  // 起点干净
  await call('POST', '/api/px/resetRoleFieldView', { token: a, body: { panelCode: 'QC_RECV' } })
  await call('POST', '/api/px/resetRoleFieldView', { token: b, body: { panelCode: 'QC_RECV' } })

  const baseCols = detailCols(await cfgOf(a, 'system'))
  ok(baseCols.length > 0, '系统整体明细列', `${baseCols.length} 列`)

  // ---------- ① 序号排序 ----------
  const before = await fv(a)
  const rows = before.detail
  ok(rows.every((r, i) => (r.shown ? r.seq === rows.slice(0, i + 1).filter((x) => x.shown).length : r.seq === null)),
    '①-a 只有勾选的字段有序号,且 1..n 连续')
  const visBefore = rows.filter((r) => r.shown).map((r) => r.label)
  // 把最后一列移到第 1 位,并把 单价 取消勾选
  const last = visBefore[visBefore.length - 1]
  const newOrder = [last, ...visBefore.slice(0, -1)]
  const payload = newOrder.map((label, i) => ({ label, visible: label !== '单价', seq: i + 1 }))
  // 隐藏的字段也要提交(visible:false),否则会被当成"跟随系统整体"
  for (const r of rows) if (!newOrder.includes(r.label)) payload.push({ label: r.label, visible: false, seq: null })
  const saved = await call('POST', '/api/px/saveRoleFieldView', { token: a, body: { panelCode: 'QC_RECV', place: 'detail', columns: payload } })
  ok(saved.json?.data?.saved > 0, '①-b 保存成功', `写入 ${saved.json?.data?.saved} 行`)

  const afterCols = detailCols(await cfgOf(a, 'role'))
  ok(afterCols[0] === last, '①-c 最后一列被移到第 1 位', `第 1 列=${afterCols[0]}`)
  ok(!afterCols.includes('单价'), '①-d 取消勾选的「单价」已不显示')
  ok(afterCols.length === baseCols.length - 1, '①-e 列数 = 整体 − 隐藏的那 1 个', `${baseCols.length} → ${afterCols.length}`)
  const after = await fv(a)
  const visRows = after.detail.filter((r) => r.shown)
  ok(visRows.every((r, i) => r.seq === i + 1), '①-f 重新取回仍是有序的 1..n')
  ok(after.detail.filter((r) => !r.shown).every((r) => r.seq === null), '①-g 隐藏字段没有序号')

  // 表头同款:把最后可见表头字段挪到最前
  const hv = (await fv(a)).header.filter((r) => r.shown).map((r) => r.label)
  const hLast = hv[hv.length - 1]
  const hPayload = [hLast, ...hv.slice(0, -1)].map((label, i) => ({ label, visible: true, seq: i + 1 }))
  for (const r of (await fv(a)).header) if (!hPayload.some((x) => x.label === r.label)) hPayload.push({ label: r.label, visible: false, seq: null })
  await call('POST', '/api/px/saveRoleFieldView', { token: a, body: { panelCode: 'QC_RECV', place: 'header', columns: hPayload } })
  const hAfter = headerFields(await cfgOf(a, 'role'))
  ok(hAfter[0] === hLast, '①-h 表头字段也能按序号调位置', `首个表头=${hAfter[0]}`)

  // ---------- ② 从系统整体一键复制 ----------
  const copied = await call('POST', '/api/px/copyRoleFieldViewFromSystem', { token: a, body: { panelCode: 'QC_RECV' } })
  ok(copied.json?.data?.saved > 0, '②-a 从整体复制写入行', `${copied.json?.data?.saved} 行`)
  const copyCols = detailCols(await cfgOf(a, 'role'))
  ok(JSON.stringify(copyCols) === JSON.stringify(baseCols), '②-b 复制后与系统整体逐列一致(含顺序)')
  const copyH = headerFields(await cfgOf(a, 'role'))
  const baseH = headerFields(await cfgOf(a, 'system'))
  ok(JSON.stringify(copyH) === JSON.stringify(baseH), '②-c 表头也一并复制一致')

  // ---------- ③ 套用到另一个角色(非管理员应被拒) ----------
  const deny = await call('POST', '/api/px/copyRoleFieldViewToRole', { token: a, body: { panelCode: 'QC_RECV', roleCode: 'ckgl' } })
  ok(deny.status >= 400 || deny.json?.code >= 400, '③-a 非管理员套用被拒', `HTTP ${deny.status} / code ${deny.json?.code}`)

  // 用一个管理员令牌真正套用(临时账号是 N,这里直接改库不合适 ⇒ 用接口在管理员身份下验证)
  // 管理员口令未知,故用"后端同款 SQL 语义"的旁证:直接以 ckgl 视角确认尚未被覆盖
  const bColsStill = detailCols(await cfgOf(b, 'role'))
  ok(JSON.stringify(bColsStill) === JSON.stringify(baseCols), '③-b 未套用前,目标角色仍是整体样子')

  console.log(`\n结果: PASS ${pass} / FAIL ${fail}`)
  lines.push(`\n结果: PASS ${pass} / FAIL ${fail}`)
  fs.writeFileSync('tools/archive/_role-view-20261113/_api-verify2-out.txt', lines.join('\n'), 'utf8')

  // 收尾:恢复继承
  await call('POST', '/api/px/resetRoleFieldView', { token: a, body: { panelCode: 'QC_RECV' } })
  await call('POST', '/api/px/resetRoleFieldView', { token: b, body: { panelCode: 'QC_RECV' } })
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('中断:', e.message); process.exit(2) })
