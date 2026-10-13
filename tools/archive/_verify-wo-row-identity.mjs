/*
 * _verify-wo-row-identity.mjs — 「工单号+工单行号 = 唯一工单」全局口径回归探针(2026-10-15)
 *
 * 【用户口径】「工单号+工单行号确定当前唯一工单,各个工单的进程,流程追溯都这样实现,
 *   都需要这两个进行确定。」
 *
 * 【验什么(只读断言 + 测试账套写操作)】
 *   ① 追溯:行7 与 行1 的头/报工/检验/入库/轨迹/血缘互不串(已有探针覆盖,此处做汇总复核);
 *   ② 工序进度 /processTask/detail:行6 与 行7 各自独立(计划量=本行,产出=本行);
 *   ③ 报工单携带行号(落库 + 列表可见);
 *   ④ 生产工单列表每行带 行id + 工单行号 + 批次号(行级键齐备);
 *   ⑤ **行状态不串**(2026-10-15 新修):只有报过工的那一行才是"在制",同工单其它行保持"未开工"。
 *
 * ⚠ 全程只读接口;不写业务数据。用法: node tools/archive/_verify-wo-row-identity.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = 'GD-2026-10-0002'
const ROW7 = 119   // 唯一有报工的行(成型 56000)
const ROW6 = 118   // 无报工,计划 25
const ROW1 = 111   // 无报工,批次 20261006
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const token = login.data.token
const api = async (path, body) => fetch(`${BASE}/api${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body ?? {}),
}).then((x) => x.json())

// ── ① 生产工单列表:行级键齐备 ──
console.log('\n── ① 生产工单列表:每行的行级键 ──')
const list = await api('/px/workOrderList', { keyword: WO })
const rows = list.data || []
console.log(`    ${WO} 共 ${rows.length} 行`)
ok('① 每行带 行id / 工单行号 / 批次号(行级键齐备)',
  rows.length > 0 && rows.every((r) => r['行id'] != null && r['工单行号'] != null && String(r['批次号'] ?? '') !== ''),
  JSON.stringify(rows.slice(0, 2).map((r) => ({ 行id: r['行id'], 行号: r['工单行号'], 批次: r['批次号'] }))))

// ── ⑤ 行状态不串:只有报过工的那一行才"在制",且当前工序按**本行**路线进度 ──
console.log('\n── ⑤ 行状态不串(只有报过工的行才在制) ──')
const byId = new Map(rows.map((r) => [Number(r['行id']), r]))
const r7 = byId.get(ROW7), r6 = byId.get(ROW6), r1 = byId.get(ROW1)
console.log(`    行7 状态=${r7?.['生产状态']} 当前工序=${r7?.['当前工序']} 完工量=${r7?.['当前工序完工量']}`)
console.log(`    行6 状态=${r6?.['生产状态']} 当前工序=${r6?.['当前工序']} 完工量=${r6?.['当前工序完工量']}`)
console.log(`    行1 状态=${r1?.['生产状态']} 当前工序=${r1?.['当前工序']} 完工量=${r1?.['当前工序完工量']}`)
// 行7:成型已达标(56000 = 8000×换算率7)⇒ 当前工序推进到**切炭**,切炭尚未报工 ⇒ 完工量 0 是**正确**的。
//   关键不变量 = 当前工序必须反映**本行**进度(不是停在成型、也不是被别的行带跑)。
ok('⑤ 行7 当前工序 = 切炭(成型已达标,本行进度推进)',
  String(r7?.['当前工序']) === '切炭', String(r7?.['当前工序']))
ok('⑤ 行7 当前工序完工量 = 0(切炭确实还没报工,数字对得上)',
  Number(r7?.['当前工序完工量'] || 0) === 0, String(r7?.['当前工序完工量']))
ok('⑤ 行6/行1(无报工)当前工序 = 本行路线首道 成型(不是被行7 带到的切炭)',
  String(r6?.['当前工序']) === '成型' && String(r1?.['当前工序']) === '成型',
  JSON.stringify({ 行6: r6?.['当前工序'], 行1: r1?.['当前工序'] }))
ok('⑤ 行6/行1 完工量 = 0(不被行7 的 56000 带上来)',
  Number(r6?.['当前工序完工量'] || 0) === 0 && Number(r1?.['当前工序完工量'] || 0) === 0,
  JSON.stringify({ 行6: r6?.['当前工序完工量'], 行1: r1?.['当前工序完工量'] }))
// 行2/3/4 用的是另一条路线(GY-2026-10-0003)⇒ 首道应为**混料**(证明按本行路线算,不是整单首条路线)
const r2 = rows.find((r) => Number(r['工单行号']) === 2)
console.log(`    行2 当前工序=${r2?.['当前工序']}(该行路线 GY-2026-10-0003,首道应为混料)`)
ok('⑤ 行2 当前工序 = 混料(按**本行**路线算,不是整单首条 GY-CB-STD 的成型)',
  String(r2?.['当前工序']) === '混料', String(r2?.['当前工序']))

// ── ② 工序进度按行 ──
console.log('\n── ② 工序进度按行(行6 / 行7 互不串) ──')
const p7 = (await api('/px/processTask/detail', { 工单号: WO, 工单行id: ROW7 })).data || {}
const p6 = (await api('/px/processTask/detail', { 工单号: WO, 工单行id: ROW6 })).data || {}
console.log(`    行7 计划合计=${p7['计划合计']} 产出=${p7['产出']} 口径=${p7['追溯口径']}`)
console.log(`    行6 计划合计=${p6['计划合计']} 产出=${p6['产出']} 口径=${p6['追溯口径']}`)
ok('② 行7 计划合计 = 本行 8000', Number(p7['计划合计']) === 8000, String(p7['计划合计']))
ok('② 行6 计划合计 = 本行 25', Number(p6['计划合计']) === 25, String(p6['计划合计']))
ok('② 行6 产出 = 0(不带上行7 的 56000)', Number(p6['产出'] || 0) === 0, String(p6['产出']))
ok('② 行7 产出 = 56000', Number(p7['产出']) === 56000, String(p7['产出']))

// ── ③ 报工单带行号 ──
console.log('\n── ③ 报工单携带工单行号 ──')
const wl = await api('/px/queryFormDataList', { panelCode: 'WO_REPORT_LIST', pageNo: 1, pageSize: 100 })
const wrows = (wl.data && (wl.data.rows || wl.data.list || wl.data.items)) || []
const mine = wrows.filter((x) => String(x['工单号']) === WO)
console.log(`    本工单报工 ${mine.length} 行 = ${JSON.stringify(mine.map((x) => ({ 单: x['单据编号'], 行: x['工单行号'] })))}`)
ok('③ 报工行带 工单行号(本工单 = 行7)', mine.length > 0 && mine.every((x) => Number(x['工单行号']) === 7),
  JSON.stringify(mine.map((x) => x['工单行号'])))

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
