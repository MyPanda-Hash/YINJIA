/**
 * 库存记账恢复验证(2026-10-14):其他入库单 / 其他出库单 走**真实后端路径**审核 → 记账 → 弃审 → 红冲。
 *
 * 断言(与 StockFlowService / StockLedgerService 的实现口径一致):
 *   ① 审核后 inh(src=3)/ outh(src=7) 出现该单据的流水行,asp_cancel='N';
 *   ② kucun 结存(键: wzdm=存货编码, ckdm=仓库编码, lot_no)按数量增减;
 *   ③ 弃审后同一 (src, rid) 流水行被**软删红冲**(asp_cancel='Y'),kucun 回到基线。
 *
 * 安全边界:全程**测试账套**(登录 factory='YJ_TEST'),正式库 HSDZ_MES 不动。
 * 依赖:测试账套里有 Phase 3 写入的 3 张金蝶样例单据(asp_user1='样例取样')。
 *
 * 用法: node tools/archive/_verify-stock-posting-e2e-1014.mjs
 */
import mssql from '../../deploy/node_modules/mssql/index.js'

const BASE = process.env.YJ_API || 'http://127.0.0.1:8090'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST',
  user: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})
const one = async (sql) => (await pool.request().query(sql)).recordset[0] || {}
const all = async (sql) => (await pool.request().query(sql)).recordset || []

const IN_DOC = 'QTRK-20261014-00092'   // 其他入库单样例:数量 1050,存货 C-95-13,仓库 CK04
const OUT_DOC = 'QTCK-20261014-01173'  // 其他出库单样例:数量 180(3 行,首行 180)
const CODE = 'C-95-13', WH = 'CP-02', WHNAME = 'B仓'   // 测试库里 CK04 已停用作废,用启用中的 CP-02

// ① 复位成「未审核」:审核动作才能触发记账(yj_doc_status 就是审核真源)
await pool.request().query(`DELETE FROM yj_doc_status WHERE doc_no IN ('${IN_DOC}','${OUT_DOC}')`)
// 同时清掉可能残留的流水/结存痕迹,保证从干净基线开始
await pool.request().query(`DELETE FROM inh  WHERE 单据编号 IN ('${IN_DOC}','${OUT_DOC}')`)
await pool.request().query(`DELETE FROM outh WHERE 单据编号 IN ('${OUT_DOC}')`)
await pool.request().query(`DELETE FROM kucun WHERE wzdm = '${CODE}' AND ckdm = '${WH}'`)
// 夹具对齐(2026-10-14):取样脚本每次重跑都会把明细分值还原成金蝶原值,而**出库要扣库存**必须以
// 入库单建立的同一库存键为前提 ⇒ 把两张单据的明细统一到同一库存键(存货 / 仓 / 无批号),
// 让「入库建结存 → 出库扣结存」形成闭环(记账逻辑与单据取值无关,这里只是造出可验证的库存条件)。
// ⚠ 仓库必须选**启用中**的:测试库里 CK04 已被金蝶仓库对齐脚本软删(停用+作废),用 CP-02/B仓。
//    批号也必须给:出库对批次管理物料有「必须带批号」的业务守卫,且入库/出库要**同批号**才能扣到同一结存行。
await pool.request().query(`UPDATE bl_other_in  SET 存货编码='${CODE}', 仓库编码='${WH}', 仓库='${WHNAME}', 批号='E2E1014' WHERE 单据编号='${IN_DOC}'`)
await pool.request().query(`UPDATE bl_other_out SET 存货编码='${CODE}', 仓库编码='${WH}', 仓库='${WHNAME}', 批号='E2E1014' WHERE 单据编号='${OUT_DOC}'`)
console.log('① 已复位:样例置未审核、清空流水/结存,并把明细对齐到同一库存键(' + CODE + ' / ' + WH + ' / 无批号)')

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = login?.data?.token
if (!token) { console.log('❌ 登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(1) }
console.log('② 已用测试账套会话登录')

const call = async (panelCode, buttonName, doc) => {
  const r = await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    // 单号要**两个键都给**:审核类按钮读 formData.编号(requireNo),转ERP 读 单据编号(见 pushToErp)
    body: JSON.stringify({ panelCode, buttonName, formData: { 编号: doc, 单据编号: doc }, buttonParam: {} }),
  })).json()
  return { ok: r?.code === 0 || r?.success === true || !!r?.data, msg: r?.data?.message || r?.message || JSON.stringify(r).slice(0, 220) }
}
const yl = async () => Number((await one(`SELECT ISNULL(SUM(yl),0) AS yl FROM kucun WHERE wzdm='${CODE}' AND ckdm='${WH}'`)).yl || 0)
const flow = async (tbl, src, doc) => await all(`SELECT id, src, rid, 数量, asp_cancel FROM ${tbl} WHERE src=${src} AND 单据编号='${doc}'`)

/** 审核是**两步**:先「提交审批」进入审批中,再「审批通过」才会落已审核并触发记账。 */
const approve = async (panelCode, doc) => {
  const s = await call(panelCode, '提交审批', doc)
  const a = await call(panelCode, '审批通过', doc)
  return { ok: a.ok, msg: `提交:${String(s.msg).slice(0, 60)} | 通过:${String(a.msg).slice(0, 120)}` }
}

let bad = 0
const chk = (label, ok, detail) => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`) }

// ② 其他入库:审核 → 记账
console.log('\n③ 其他入库单 审核 → 记账')
let base = await yl()
let r = await approve('OTHER_IN', IN_DOC)
console.log(`   审批通过: ${r.ok ? '✅' : '❌'} ${String(r.msg).slice(0, 120)}`)
const inhRows = await flow('inh', 3, IN_DOC)
chk('inh 出现 src=3 流水行', inhRows.length > 0, `${inhRows.length} 行`)
chk('流水未软删', inhRows.every((x) => x.asp_cancel !== 'Y'))
let now = await yl()
chk('kucun 结存增加', now > base, `${base} → ${now}`)

// ③ 其他出库:审核 → 记账(库存已由上一单建立,避免负库存守卫)
console.log('\n④ 其他出库单 审核 → 记账')
const outQty = Number((await one(`SELECT ISNULL(SUM(数量),0) AS q FROM bl_other_out WHERE 单据编号='${OUT_DOC}'`)).q || 0)
base = await yl()
r = await approve('OTHER_OUT', OUT_DOC)
console.log(`   审批通过: ${r.ok ? '✅' : '❌'} ${String(r.msg).slice(0, 120)}`)
const outhRows = await flow('outh', 7, OUT_DOC)
chk('outh 出现 src=7 流水行', outhRows.length > 0, `${outhRows.length} 行`)
now = await yl()
chk('kucun 结存减少', now < base, `${base} → ${now}(出库合计 ${outQty})`)

// ④ 弃审 → 红冲
console.log('\n⑤ 两张单据弃审 → 流水红冲 + 结存回退')
r = await call('OTHER_OUT', '弃审', OUT_DOC)
console.log(`   其他出库弃审: ${r.ok ? '✅' : '❌'} ${String(r.msg).slice(0, 120)}`)
chk('outh 流水被软删红冲', (await flow('outh', 7, OUT_DOC)).every((x) => x.asp_cancel === 'Y'))
const ylAfterOutUnpost = await yl()
r = await call('OTHER_IN', '弃审', IN_DOC)
console.log(`   其他入库弃审: ${r.ok ? '✅' : '❌'} ${String(r.msg).slice(0, 120)}`)
chk('inh 流水被软删红冲', (await flow('inh', 3, IN_DOC)).every((x) => x.asp_cancel === 'Y'))
const ylFinal = await yl()
chk('结存回到基线(0)', ylFinal === 0, `出库弃审后 ${ylAfterOutUnpost} → 入库弃审后 ${ylFinal}`)

await pool.close()
console.log(`\n结论:${bad === 0 ? '✅ 其他入库/其他出库 记账与红冲全部通过' : `❌ 有 ${bad} 项断言未通过`}`)


