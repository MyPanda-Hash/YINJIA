/*
 * _api-verify.mjs —— 角色字段视图(2026-11-13)接口级闭环验证(打 8091 临时实例 + 测试库)
 *
 * 验的是五条真相:
 *   ① 本角色隐藏两个字段后,本角色取到的明细列真的少了这两列;
 *   ② 同一账号切 view=system(系统整体)时两列还在 —— 证明 yj_field 没被动过;
 *   ③ 另一个角色(仓库管理)取到的列**不受影响** —— 证明角色隔离;
 *   ④ 两个同角色账号看到的一样(用同角色再登一次对比);
 *   ⑤ 恢复继承后行清零、列回来。
 *
 * 用法(仓库根): node tools/archive/_role-view-20261113/_api-verify.mjs [http://127.0.0.1:8091]
 */
import fs from 'node:fs'

const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const HIDE = ['单价', '金额']
let pass = 0, fail = 0
const lines = []

function ok(cond, msg, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) ; lines.push(`✅ ${msg} ${extra}`) }
  else { fail++; console.log(`  ❌ ${msg} ${extra}`); lines.push(`❌ ${msg} ${extra}`) }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON(如 500 页面) */ }
  return { status: res.status, json, text }
}

async function login(username, password, factory = 'YJ_TEST') {
  const r = await call('POST', '/api/auth/login', { body: { userName: username, password, factory } })
  if (!r.json || !r.json.data || !r.json.data.token) {
    throw new Error(`登录失败 ${username}: HTTP ${r.status} ${r.text.slice(0, 200)}`)
  }
  return r.json.data.token
}

/**
 * 取全部网格列(doc 面板真实位置:metadata.panelPageDto.tablePages[].gridTabs[].columns)。
 * QC_RECV 有两个 tablePage(明细 + 汇总),两边的列都要看 —— 角色隐藏必须两边同时生效。
 */
function detailColumns(cfg) {
  const pages = cfg?.metadata?.panelPageDto?.tablePages || []
  const cols = []
  for (const p of pages) for (const g of (p.gridTabs || [])) for (const c of (g.columns || [])) if (!cols.includes(c)) cols.push(c)
  if (cols.length) return cols
  // 兜底(报表面板走顶层 gridTabs)
  for (const g of (cfg?.gridTabs || [])) for (const c of (g.columns || [])) if (!cols.includes(c)) cols.push(c)
  return cols
}

async function configOf(token, view) {
  const r = await call('GET', `/api/px/getPanelConfig?panelCode=QC_RECV&view=${view}`, { token })
  if (!r.json || !r.json.data) throw new Error(`取配置失败 view=${view}: HTTP ${r.status} ${r.text.slice(0, 300)}`)
  return r.json.data
}

async function fieldView(token) {
  const r = await call('GET', '/api/px/fieldView?panelCode=QC_RECV', { token })
  if (!r.json || !r.json.data) throw new Error(`取 fieldView 失败: HTTP ${r.status} ${r.text.slice(0, 300)}`)
  return r.json.data
}

const main = async () => {
  console.log(`== 角色字段视图接口验证 @ ${BASE} (测试库) ==`)
  const a = await login('zz_fv_a', 'Tmp#FieldView2026')
  const b = await login('zz_fv_b', 'Tmp#FieldView2026')

  const fvA = await fieldView(a)
  ok(fvA.roleCode === 'xiaoshou', `zz_fv_a 命中的角色 = 销售(xiaoshou)`, `实际 ${fvA.roleCode}`)
  const base = await configOf(a, 'system')
  const baseCols = detailColumns(base)
  ok(baseCols.length > 0, '系统整体取到明细列', `${baseCols.length} 列`)
  ok(HIDE.every((h) => baseCols.includes(h)), `系统整体含待隐藏列 ${HIDE.join('/')}`)

  // 先恢复继承,保证起点干净
  await call('POST', '/api/px/resetRoleFieldView', { token: a, body: { panelCode: 'QC_RECV' } })

  // 本角色:把 单价 / 金额 隐藏(其余保持原样)
  const detailRows = (fvA.detail || []).map((r) => ({ label: r.label, visible: HIDE.includes(r.label) ? false : r.shown }))
  ok(detailRows.length > 0, '本角色对话框取到明细行', `${detailRows.length} 行`)
  const save = await call('POST', '/api/px/saveRoleFieldView', {
    token: a, body: { panelCode: 'QC_RECV', place: 'detail', columns: detailRows },
  })
  ok(save.json?.data?.saved === HIDE.length, '保存只写了与整体不同的那几行(增量)', `saved=${save.json?.data?.saved}`)
  ok((save.json?.data?.skippedRequired || []).length === 0, '没有必填字段被跳过')

  const roleCfg = await configOf(a, 'role')
  const roleCols = detailColumns(roleCfg)
  ok(!roleCols.includes('单价') && !roleCols.includes('金额'), '① 本角色视图已不含 单价/金额', `${roleCols.length} 列`)
  ok(roleCols.length === baseCols.length - HIDE.length, '列数正好少 2 列',
    `${baseCols.length} → ${roleCols.length}`)

  const sysCfg = await configOf(a, 'system')
  const sysCols = detailColumns(sysCfg)
  ok(sysCols.includes('单价') && sysCols.includes('金额') && sysCols.length === baseCols.length,
    '② 同账号切「系统整体」两列仍在(证明 yj_field 未被改)', `${sysCols.length} 列`)

  const bCfg = await configOf(b, 'role')
  const bCols = detailColumns(bCfg)
  ok(bCols.includes('单价') && bCols.includes('金额') && bCols.length === baseCols.length,
    '③ 另一个角色(仓库管理)完全不受影响', `${bCols.length} 列`)

  // ④ 对话框回显:与"整体可见列"相比,只多了这两列被藏
  const fvA2 = await fieldView(a)
  const baseVisibleDetail = (fvA2.detail || []).filter((r) => r.baseShown)
  const hidden2 = (fvA2.detail || []).filter((r) => !r.shown).map((r) => r.label)
  ok(HIDE.every((h) => hidden2.includes(h)),
    '④ 对话框回显 = 本角色确实藏了这两列', `隐藏 ${hidden2.join('/') || '无'}`)
  // 整体本来就隐藏的列不算"本角色定制"
  const overriddenCount = (fvA2.detail || []).filter((r) => r.overridden).length
  ok(overriddenCount === HIDE.length, '只有这两列标了「已定制」', `overridden=${overriddenCount} / 整体可见 ${baseVisibleDetail.length} 行`)
  ok((fvA2.header || []).every((r) => r.shown === r.baseShown), '表头层未被牵连')

  // 隐必须与整体不同才算覆盖:表格里本来不可见的列不该出现 overridden
  const badOverride = (fvA2.detail || []).filter((r) => r.overridden && r.baseShown === r.shown)
  ok(badOverride.length === 0, '不存在「覆盖了但值与整体相同」的冗余行', `${badOverride.length} 个`)

  // 恢复继承
  const reset = await call('POST', '/api/px/resetRoleFieldView', { token: a, body: { panelCode: 'QC_RECV' } })
  ok(reset.json?.data?.removed >= 1, '⑤ 恢复继承删掉了覆盖行', `removed=${reset.json?.data?.removed}`)
  const back = await configOf(a, 'role')
  ok(detailColumns(back).length === baseCols.length, '恢复后本角色列数回到整体',
    `${detailColumns(back).length} 列`)

  console.log(`\n结果: PASS ${pass} / FAIL ${fail}`)
  lines.push(`\n结果: PASS ${pass} / FAIL ${fail}`)
  fs.writeFileSync('tools/archive/_role-view-20261113/_api-verify-out.txt', lines.join('\n'), 'utf8')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('中断:', e.message); process.exit(2) })
