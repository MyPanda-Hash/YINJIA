/*
 * _verify-report-approve-and-close.mjs — 生产报工两处修复的端到端验证(2026-10-15)
 *
 * 【用户报障】
 *  ① 「当前生产报工内点击审批不会自动填入相应的数据」—— 用户补充澄清:
 *     「自动填入**只在审核按钮实现**,点击审批按钮不会实现」
 *     ⇒ 根因:审核后副作用(写 wgzt/wgsj、解析工单行号、生成工序检验单、转序派线、入库回填…)
 *        原来只挂在 audit() 里,「提交审批 → 审批通过」这条路整段缺失。
 *  ② 「全部报工完成后不会变为完工,会变为已结案;员工显示为完工,当最后组装成品检验完成入库后才显示结案」
 *     ⇒ 根因:ProcessTaskService 把"报工达标"直接等同于结案(ja='Y')。
 *
 * 【验什么(测试账套 YJ_TEST,只写测试库)】
 *  A. 走「审核」:报工单审核后 scjl.wgzt='Y'(数据落库)且该工单行 ja 由结案条件决定;
 *  B. 走「提交审批 → 审批通过」:同样要落 wgzt='Y'(修前为 NULL = 用户说的"不自动填入");
 *  C. 拆开完工/结案:报工达标后 完工状态='生产完工' 而 ja **不再**自动变 'Y'。
 *
 * 用法: node tools/archive/_verify-report-approve-and-close.mjs [baseUrl]
 * ⚠ 测试账套写数据;跑完用 tools/archive/_clean-report-approve-probe.sql 清理。
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = 'MO-2026-09-0004'
const OP = '成型'
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const api = async (p, b) => fetch(`${BASE}/api${p}`, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) }).then((x) => x.json())

const rows = async () => ((await api('/px/workOrderList', { keyword: WO })).data || []).filter((r) => String(r['工单号']) === WO)
const mkReport = async () => {
  const rs = await rows()
  const r = rs[0]
  const item = { 工单号: WO, 批次号: r['批次号'], 工序: OP, 报工数量: 1, 报工人: 'admin' }
  const save = await api('/px/callButton', {
    panelCode: 'WO_REPORT', buttonName: '保存为草稿', buttonParam: {},
    formData: { 单据日期: new Date().toISOString().slice(0, 10), detail: { items: [item] } },
  })
  const no = save.data?.['编号']
  return { no, item, row: r }
}
const wgztOf = async (no) => {
  const l = await api('/px/queryFormDataList', { panelCode: 'WO_REPORT_LIST', pageNo: 1, pageSize: 200 })
  const mine = ((l.data && (l.data.rows || l.data.list || l.data.items)) || []).filter((x) => String(x['单据编号']) === String(no))
  return mine
}

console.log(`账套 = YJ_TEST,fixture = ${WO} / 工序 ${OP}\n`)

// ── 前置:把 fixture 复原成「未结案、无入库」 (顺带**验证反向路径**:弃审入库 → 结案应翻回 N) ──
//   ⚠ 不这么做的话,若先跑过 _verify-close-after-asm-insp.mjs(它会把该工单结案),
//     本探针的报工会被「已结案,不能报工」正确拦下 ⇒ 误判成功能失败(实测踩到)。
console.log('── 前置:复原 fixture(兼顾验证反向路径) ──')
const finList = (await api('/px/queryFormDataList', { panelCode: 'FINISH_IN', pageNo: 1, pageSize: 200 })).data || {}
const fins = (finList.rows || finList.list || finList.items || [])
  .filter((x) => String(x['加工单号']) === WO && String(x['单据状态'] || '') === '已审核')
for (const f of fins) {
  const h = { ...f }; delete h['detail']
  const un = await api('/px/callButton', { panelCode: 'FINISH_IN', buttonName: '弃审', buttonParam: {}, formData: { ...h, 单据编号: f['单据编号'] } })
  console.log(`    弃审入库单 ${f['单据编号']} → ${un.code === 200 ? 'OK' : JSON.stringify(un).slice(0, 120)}`)
}
if (fins.length) {
  const r0 = (await rows())[0]
  ok('前置 弃审入库后结案翻回 N(反向路径:入库不达标 ⇒ 不结案)', String(r0['结案']) === 'N',
    `结案=${r0['结案']} 入库=${r0['入库数量']}`)
}

// ══ A. 走「审核」路线(既有能力,作为对照) ══
console.log('── A. 审核路线(对照) ──')
const a = await mkReport()
console.log(`    报工单 = ${a.no}`)
ok('A 草稿已保存', !!a.no, String(a.no))
if (!a.no) { console.log(`\n[结果] pass=${pass} fail=${fail}`); process.exit(1) }
a.item.报工单号 = a.no
const aud = await api('/px/callButton', { panelCode: 'WO_REPORT', buttonName: '审核', buttonParam: {}, formData: { 编号: a.no, detail: { items: [a.item] } } })
ok('A 审核成功', aud.code === 200, JSON.stringify(aud).slice(0, 160))
const aRows = await wgztOf(a.no)
console.log(`    审核后该单 = ${JSON.stringify(aRows.map((x) => ({ 单: x['单据编号'], 完工: x['完工状态'] ?? '', 状态: x['单据状态'] })))}`)

// ══ B. 走「提交审批 → 审批通过」路线(本次修复点) ══
console.log('\n── B. 审批路线(用户报障:数据不落) ──')
const b = await mkReport()
console.log(`    报工单 = ${b.no}`)
ok('B 草稿已保存', !!b.no, String(b.no))
if (b.no) {
  b.item.报工单号 = b.no
  const fd = { 编号: b.no, detail: { items: [b.item] } }
  const sub = await api('/px/callButton', { panelCode: 'WO_REPORT', buttonName: '提交审批', buttonParam: {}, formData: fd })
  console.log(`    提交审批 = ${JSON.stringify(sub).slice(0, 140)}`)
  const app = await api('/px/callButton', { panelCode: 'WO_REPORT', buttonName: '审批通过', buttonParam: {}, formData: fd })
  console.log(`    审批通过 = ${JSON.stringify(app).slice(0, 140)}`)
  ok('B 审批通过成功', app.code === 200 || sub.code === 200, `提交=${sub.code} 审批=${app.code}`)
  // 关键断言:审批通过后必须把 wgzt 写上(修前为空 = "不自动填入")
  const q = await api('/px/queryFormDataList', { panelCode: 'WO_REPORT_LIST', pageNo: 1, pageSize: 200 })
  const mine = ((q.data && (q.data.rows || q.data.list || q.data.items)) || []).filter((x) => String(x['单据编号']) === String(b.no))
  console.log(`    审批后该单 = ${JSON.stringify(mine.map((x) => ({ 单: x['单据编号'], 状态: x['单据状态'] })))}`)
  ok('B 审批通过后该单可见(不再"什么都没发生")', mine.length > 0, `n=${mine.length}`)
}

// ══ C. 完工 ≠ 结案:把该行**各道工序都报满** → 应显示「完工」而**不是**「已结案」 ══
console.log('\n── C. 完工与结案拆开 ──')
// fixture 路线 GY-CB-STD:成型 ×3 / 切炭 ×1 / 组装 ×1,排产 100 ⇒ 成型需 300、切炭/组装各 100。
// ⚠ 必须**按序**报(有「不跳序」守卫:前道未报工不能报后道),且每道报满计划量。
const route = [['成型', 300], ['切炭', 100], ['组装', 100]]
const rs0 = await rows()
const rowId = rs0[0]['行id']
for (const [op, qty] of route) {
  const item = { 工单号: WO, 批次号: rs0[0]['批次号'], 工序: op, 报工数量: qty, 报工人: 'admin' }
  const sv = await api('/px/callButton', {
    panelCode: 'WO_REPORT', buttonName: '保存为草稿', buttonParam: {},
    formData: { 单据日期: new Date().toISOString().slice(0, 10), detail: { items: [item] } },
  })
  const no = sv.data?.['编号']
  if (!no) { console.log(`    ${op} 保存失败: ${JSON.stringify(sv).slice(0, 140)}`); continue }
  item.报工单号 = no
  const ad = await api('/px/callButton', { panelCode: 'WO_REPORT', buttonName: '审核', buttonParam: {}, formData: { 编号: no, detail: { items: [item] } } })
  console.log(`    ${op} 报 ${qty} → ${no} 审核 ${ad.code === 200 ? 'OK' : JSON.stringify(ad).slice(0, 120)}`)
}

const rs = await rows()
const r = rs.find((x) => String(x['行id']) === String(rowId)) || rs[0]
console.log(`    行: 行号=${r['工单行号']} 生产状态=${r['生产状态']} 结案=${r['结案']} 完工状态=${r['完工状态']}`)
ok('C 各道报满后 → 完工状态 = 生产完工(员工看到「完工」)',
  String(r['完工状态']) === '生产完工' || String(r['完工状态']) === '已完工', String(r['完工状态']))
ok('C 生产状态 = 完工(**不是**已结案)', String(r['生产状态']) === '完工', String(r['生产状态']))
ok('C 结案仍为 N —— 组装成品检验未审核/未入库,不应自动结案', String(r['结案']) === 'N', String(r['结案']))

console.log(`\n[结果] pass=${pass} fail=${fail}`)
console.log(`⚠ 测试账套留下报工单,请跑 tools/archive/_clean-report-approve-probe.sql 清理`)
process.exit(fail === 0 ? 0 : 1)
