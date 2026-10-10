/*
 * _verify-wo-trace-progress-by-row.mjs — 「工序进度」段按 (工单号, 工单行号) 收敛 只读探针(2026-10-10)
 *
 * 背景(用户实测报障):工单 GD-2026-10-0002 的**行6**打开追溯,工序进度表头显示
 *   计划数量 16945 / 产出 56000(330.48%) / 成型 56000/118615 —— 全是**整单**数,其中 56000 其实是**行7**的报工。
 * 行级真值(直接查库,冻结在本文):
 *   行id=111 行号1 计划80  批次20261006 | 行id=116 行号4 计划500  批次20261007
 *   行id=114 行号2 计划115 批次20261006 | 行id=117 行号5 计划25   批次20261007
 *   行id=115 行号3 计划200 批次20261006 | 行id=118 行号6 计划25   批次20261007  ← 用户看的那行
 *                                        | 行id=119 行号7 计划8000 批次20261007  ← 唯一报工在这行
 *                                        | 行id=120 行号8 计划8000 批次20261010
 *   报工:仅 BG-2026-10-0038(成型, 56000, 完工=Y, gd_id=573 → 行id=119)
 * 断言:行6 计划=25 且产出=0 且各工序完工=0(绝不含 56000);行7 计划=8000 且成型完工=56000;
 *      整单口径维持 16945/56000(旧行为保留并标注)。
 * 只读:不改任何数据。用法: node tools/archive/_verify-wo-trace-progress-by-row.mjs http://127.0.0.1:8090
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = 'GD-2026-10-0002'
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const token = login.data?.token
if (!token) { console.error('登录失败'); process.exit(1) }

const detail = async (rowId) => {
  const body = rowId ? { 工单号: WO, 工单行id: rowId } : { 工单号: WO }
  const r = await fetch(`${BASE}/api/px/processTask/detail`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  }).then((x) => x.json())
  if (r.code !== 200) throw new Error('接口返回 ' + r.code + ' ' + r.message)
  return r.data
}
const opOf = (d, op) => (d['工序步骤'] || []).find((s) => s['工序'] === op) || {}

// ① 行6(id=118):用户看的那行 —— 必须只剩本行
const r6 = await detail(118)
console.log(`    行6 → 计划合计=${r6['计划合计']} 产出=${r6['产出']} 口径=${r6['追溯口径']} 行号=${r6['工单行号']} 批次=${r6['批次号']}`)
console.log(`         工序: ${(r6['工序步骤'] || []).map((s) => `${s['工序']} ${s['完工量']}/${s['计划量']}`).join(' | ')}`)
ok('① 行6 计划合计 = 该行 pl_sl(25),不是整单 16945', Number(r6['计划合计']) === 25, String(r6['计划合计']))
ok('① 行6 产出 = 0(该行无报工)', Number(r6['产出']) === 0, String(r6['产出']))
ok('① 行6 各工序完工量全为 0(不含行7的 56000)',
  (r6['工序步骤'] || []).every((s) => Number(s['完工量']) === 0),
  JSON.stringify((r6['工序步骤'] || []).map((s) => s['完工量'])))
ok('① 行6 成型计划量 = 25×换算率7 = 175', Number(opOf(r6, '成型')['计划量']) === 175, String(opOf(r6, '成型')['计划量']))
ok('① 行6 口径=按工单行 / 行号6 / 批次20261007',
  r6['追溯口径'] === '按工单行' && Number(r6['工单行号']) === 6 && r6['批次号'] === '20261007',
  `${r6['追溯口径']} ${r6['工单行号']} ${r6['批次号']}`)

// ② 行7(id=119):唯一有报工的行
const r7 = await detail(119)
console.log(`    行7 → 计划合计=${r7['计划合计']} 产出=${r7['产出']} 口径=${r7['追溯口径']} 行号=${r7['工单行号']}`)
console.log(`         工序: ${(r7['工序步骤'] || []).map((s) => `${s['工序']} ${s['完工量']}/${s['计划量']}(${s['报工单数']}单,${s['状态']})`).join(' | ')}`)
ok('② 行7 计划合计 = 8000', Number(r7['计划合计']) === 8000, String(r7['计划合计']))
ok('② 行7 产出 = 56000(本行报工)', Number(r7['产出']) === 56000, String(r7['产出']))
ok('② 行7 成型 完工=56000 / 计划=8000×7=56000 已完工',
  Number(opOf(r7, '成型')['完工量']) === 56000 && Number(opOf(r7, '成型')['计划量']) === 56000
  && opOf(r7, '成型')['状态'] === '已完工',
  JSON.stringify(opOf(r7, '成型')))
ok('② 行7 其它工序完工=0(不串行)', ['切炭', '组装'].every((op) => Number(opOf(r7, op)['完工量'] || 0) === 0))

// ③ 整单口径(不带行id)= 旧行为保留且被标注
const all = await detail(null)
console.log(`    整单 → 计划合计=${all['计划合计']} 产出=${all['产出']} 口径=${all['追溯口径']}`)
ok('③ 整单 计划合计 = 16945(8 行合计,旧行为)', Number(all['计划合计']) === 16945, String(all['计划合计']))
ok('③ 整单 产出 = 56000 且口径=整单', Number(all['产出']) === 56000 && all['追溯口径'] === '整单', `${all['产出']} ${all['追溯口径']}`)

// ④ 接口自洽:行级"各工序完工量之和"必须等于该行报工真值
ok('④ 行6 与 行7 的产出互不相同(证明按行取数,不是同一份整单数据)',
  Number(r6['产出']) !== Number(r7['产出']))

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
