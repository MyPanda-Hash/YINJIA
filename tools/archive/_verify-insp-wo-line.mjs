/*
 * _verify-insp-wo-line.mjs — 工序检验单带「工单行号」端到端探针(2026-10-15)
 *
 * 【用户口径】「工单号+工单行号确定当前唯一工单,各个工单的进程,流程追溯都这样实现,
 *   都需要这两个进行确定。」
 *
 * 【验什么】报工单审核 → 自动生成的工序检验单(成型 QC_MOLD_INSP)单头是否带**本行**的工单行号,
 *   而不是只有整单的工单号。
 *
 * 【做法】**测试账套(YJ_TEST)**上:
 *   ① 取一个待报工的行(工单号 + 工单行号 + 批次号);
 *   ② 保存报工单草稿(成型)→ 审核;
 *   ③ 查生成的检验单,断言 工单行号 = 本行行号;
 *   ④ 清理(弃审/作废报工单 + 作废检验单 + 释放占用链)。
 *
 * ⚠ 只在测试账套写数据,按单号精确圈定清理。
 * 用法: node tools/archive/_verify-insp-wo-line.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = 'MO-2026-09-0004'      // 测试账套 fixture:单行,成型未报工
const OP = '成型'
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const token = login.data.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const api = async (p, b) => fetch(`${BASE}/api${p}`, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) }).then((x) => x.json())

console.log(`账套 = YJ_TEST,fixture = ${WO} / 工序 ${OP}\n`)

// ── ① 取该工单行(带行号,供断言) ──
const list = await api('/px/workOrderList', { keyword: WO })
const rows = (list.data || [])
console.log(`── ① fixture 行 = ${JSON.stringify(rows.map((r) => ({ 行id: r['行id'], 行号: r['工单行号'], 批次: r['批次号'], 状态: r['生产状态'] })))}`)
ok('① fixture 有可报工的行(有行id/行号)',
  rows.length > 0 && rows.every((r) => r['行id'] != null && r['工单行号'] != null), `n=${rows.length}`)
if (!rows.length) process.exit(1)
const target = rows[0]
const wantXc = Number(target['工单行号'])

// ── ② 保存报工单草稿 → 审核 ──
console.log('\n── ② 保存报工单并审核 ──')
// ⚠ WO_REPORT 是 mode=doc / line_table=scjl / head_table=NULL 的**单表式**面板:字段全在明细行上,
//   必须走 /px/callButton + '保存为草稿',且 detail.items 不能空(否则走空白占位草稿分支)
const detailItem = { 工单号: WO, 工序: OP, 报工数量: 1, 批次号: target['批次号'], 报工人: 'admin' }
const save = await api('/px/callButton', {
  panelCode: 'WO_REPORT', buttonName: '保存为草稿', buttonParam: {},
  formData: { 单据日期: new Date().toISOString().slice(0, 10), detail: { items: [detailItem] } },
})
const repNo = save.data?.['编号'] || save.data?.['单据编号'] || save.data?.no
console.log(`    保存回执 = ${JSON.stringify(save.data).slice(0, 200)}`)
ok('② 报工单草稿已保存(拿到单号)', !!repNo, String(repNo))
if (!repNo) { console.log(`\n[结果] pass=${pass} fail=${fail}`); process.exit(1) }

detailItem.报工单号 = repNo
const audit = await api('/px/callButton', {
  panelCode: 'WO_REPORT', buttonName: '审核', buttonParam: {},
  formData: { 编号: repNo, detail: { items: [detailItem] } },
})
console.log(`    审核回执 = ${JSON.stringify(audit).slice(0, 240)}`)
const audited = audit.code === 200
ok('② 报工单已审核', audited, String(audit.message || audit.code))

// ── ③ 查生成的检验单是否带本行行号 ──
console.log('\n── ③ 生成的工序检验单(成型)是否带本行工单行号 ──')
const insp = await api('/px/queryFormDataList', { panelCode: 'QC_MOLD_INSP', pageNo: 1, pageSize: 100 })
const irows = (insp.data && (insp.data.rows || insp.data.list || insp.data.items)) || []
const mine = irows.filter((x) => String(x['报工单号']) === String(repNo))
console.log(`    本次生成的检验单 = ${JSON.stringify(mine.map((x) => ({ 单: x['单据编号'], 工单号: x['工单号'], 工单行号: x['工单行号'] })))}`)
ok('③ 审核后生成了成型检验单', mine.length > 0, `n=${mine.length}`)
ok(`③ 检验单带本行工单行号 = ${wantXc}`,
  mine.length > 0 && mine.every((x) => Number(x['工单行号']) === wantXc),
  JSON.stringify(mine.map((x) => x['工单行号'])))
ok('③ 检验单同时带整单工单号(两个键齐备)',
  mine.length > 0 && mine.every((x) => String(x['工单号']) === WO),
  JSON.stringify(mine.map((x) => x['工单号'])))

console.log(`\n[结果] pass=${pass} fail=${fail}`)

// ── ④ 自清理(保持探针可反复重跑)──────────────────────────────────────
// ⚠ 「删除」按钮只把 yj_doc_status 置 canceled,**不写业务表 asp_cancel** —— 单表式面板(scjl)与
//   检验单都得自己补软删,否则测试库留下存活草稿,下次跑会被"已有未审核"之类守卫挡住(实测踩到)。
console.log('\n── ④ 自清理 ──')
for (const no of mine.map((x) => x['单据编号'])) {
  const d = await api('/px/callButton', { panelCode: 'QC_MOLD_INSP', buttonName: '删除', formData: { 编号: no }, buttonParam: {} })
  console.log(`    检验单 ${no} 删除回执 = ${JSON.stringify(d).slice(0, 120)}`)
}
// 报工单:已审核 → 先弃审再删除
await api('/px/callButton', { panelCode: 'WO_REPORT', buttonName: '弃审', formData: { 编号: repNo, detail: { items: [detailItem] } }, buttonParam: {} })
const drep = await api('/px/callButton', { panelCode: 'WO_REPORT', buttonName: '删除', formData: { 编号: repNo }, buttonParam: {} })
console.log(`    报工单 ${repNo} 删除回执 = ${JSON.stringify(drep).slice(0, 120)}`)
console.log(`    ⚠ 业务表软删仍需 SQL 补齐(test 账套):见 tools/archive/_clean-insp-wo-line-probe.sql`)

process.exit(fail === 0 ? 0 : 1)
