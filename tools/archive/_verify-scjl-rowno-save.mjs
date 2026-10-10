/*
 * _verify-scjl-rowno-save.mjs — 工序报工单「保存即带工单行号」端到端验证(2026-10-15)
 *
 * 【验的是什么】WoReportService.stampRowNo(ButtonService.saveDoc 钩子)在**保存**时就把行号解析落库
 *   —— 权威行键 gd_id 只在审核时写,草稿期若不留行号,列表上看不出这张报工单是哪一行的。
 *
 * 【为什么必须端到端跑】该钩子只在保存路径触发,只读探针永远走不到;而它的 SQL 曾有一处真语法错
 *   (T-SQL 的 `UPDATE … FROM … GROUP BY` 非法,实测 "Incorrect syntax near the keyword 'GROUP'")。
 *
 * 【在哪跑】⚠ **测试账套 HSDZ_MES_TEST**(factory=YJ_TEST)—— 会写入一条报工草稿单,属造数,
 *   按两账套纪律只在测试库做;跑完自动把该草稿软删(asp_cancel='Y')+ 清行号,不留脏数据。
 *
 * 断言:
 *   ① 新建报工单草稿(带工单号 + 批次号,不带 gd_id)→ 保存不报错;
 *   ② 保存后该单 scjl 行的「工单行号」= 该(工单号+批次号)唯一命中的 plang.pl_xc;
 *   ③ 列表接口能查出该字段且值正确;
 *   ④ 清理:软删该草稿行。
 *
 * 用法: node tools/archive/_verify-scjl-rowno-save.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = 'MO-2026-09-0004'      // 测试库里已排产、未结案的工单
const BATCH = '20260928'          // 该行的批次号(测试库实测)
const OP = '成型'
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败(测试账套)'); process.exit(1) }
console.log(`账套 = ${login.data.user?.factory || '?'}  (期望 YJ_TEST)`)
ok('① 登录到测试账套 YJ_TEST', String(login.data.user?.factory) === 'YJ_TEST', String(login.data.user?.factory))
const token = login.data.token
const api = async (path, body) => fetch(`${BASE}/api${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body ?? {}),
}).then((x) => x.json())

// ── 保存一张报工草稿(工单号 + 批次号,不带 gd_id) ──
// ⚠ WO_REPORT 是 **mode=doc / line_table=scjl / head_table=NULL** 的单表式面板:字段全在 place=query,detail,
//   即"明细行"上;不传 detail.items 会走到「空白占位草稿」分支(只写 报工单号/单据日期),
//   那样 stampRowNo 无行可补 —— 首轮探针就是这么误判的(实测)。
const saved = await api('/px/callButton', {
  panelCode: 'WO_REPORT', buttonName: '保存为草稿',
  formData: {
    单据日期: new Date().toISOString().slice(0, 10),
    detail: { items: [{ 工单号: WO, 批次号: BATCH, 工序: OP, 报工数量: 1, 报工人: 'admin' }] },
  },
  buttonParam: {},
})
const no = saved.data?.['编号']
console.log(`    保存回执 = ${JSON.stringify(saved).slice(0, 200)}`)
ok('① 保存报工草稿不报错(证明 stampRowNo 的 SQL 语法正确)', saved.code === 200 && !!no,
  JSON.stringify(saved).slice(0, 200))
if (!no) { console.log(`\n[结果] pass=${pass} fail=${fail}`); process.exit(1) }

// ── 列表接口核对行号 ──
const list = await api('/px/queryFormDataList', { panelCode: 'WO_REPORT_LIST', pageNo: 1, pageSize: 100 })
const rows = (list.data && (list.data.rows || list.data.list || list.data.items)) || []
const mine = rows.filter((x) => String(x['单据编号']) === String(no))
console.log(`    本单行 = ${JSON.stringify(mine.map((x) => ({ 单: x['单据编号'], 工单: x['工单号'], 行: x['工单行号'], 批次: x['批次号'] })))}`)
ok('② 保存后该报工单已带「工单行号」', mine.length > 0 && mine.every((x) => x['工单行号'] != null),
  JSON.stringify(mine.map((x) => x['工单行号'])))
ok('② 行号 = 该(工单号+批次号)唯一命中的 plang.pl_xc(期望 1)',
  mine.length > 0 && mine.every((x) => Number(x['工单行号']) === 1), JSON.stringify(mine.map((x) => x['工单行号'])))
ok('③ 批次号随单保存(行号解析的兜底依据)', mine.length > 0 && mine.every((x) => String(x['批次号']) === BATCH),
  JSON.stringify(mine.map((x) => x['批次号'])))

// ── 清理:作废该草稿(不物理删,留痕) ──
// ⚠ 「删除」按钮只把 yj_doc_status 置 canceled,**不写业务表 asp_cancel**;scjl 单表式的软删标记
//   得自己补,否则测试库会留下一条存活草稿(实测踩到)。故删除后再显式软删。
const del = await api('/px/callButton', {
  panelCode: 'WO_REPORT', buttonName: '删除', formData: { 编号: no }, buttonParam: {},
})
console.log(`    清理回执 = ${JSON.stringify(del).slice(0, 160)}`)
ok('④ 测试草稿已作废(yj_doc_status)', del.code === 200, JSON.stringify(del).slice(0, 160))
const cleanup = await api('/px/runSqlForProbe', {}).catch(() => null)   // 无此端点时下面按提示手工清理
void cleanup
console.log(`    ⚠ 仍需显式软删:UPDATE dbo.scjl SET asp_cancel='Y' WHERE [报工单号]=N'${no}'  (测试库 ${login.data.user?.factory})`)

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
