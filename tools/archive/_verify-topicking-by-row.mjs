/*
 * _verify-topicking-by-row.mjs — 「转领料单」按 工单号+工单行号 的端到端复现探针(2026-10-15)
 *
 * 【复现用户报障】「当前转领料单还是不能根据工单号+工单行号进行」。
 *
 * 【关键数据形态】同一 工单号 可以有**多行共用同一个 pl_xc**(同订单行分批转单,批次号不同):
 *   测试库实测 MO-2026-09-0006 有 4 行 pl_xc **全 = 1**(批次 20260928/-2/-3/-4)、
 *   MO-2026-09-0007 有 3 行(pl_xc=1 一行;pl_xc=2 两行)—— 那种行的真实身份只有 plang.id。
 *
 * 【验什么】勾选同一工单的**多行** → 应各转各的(张数 = 勾选行数),且每张单头都带 工单行号;
 *   再验「同一行勾两次只转一张」。
 *
 * ⚠ 在**测试账套 HSDZ_MES_TEST** 跑(会造领料单草稿);跑完用 --clean 软删本探针造的单。
 * 用法: node tools/archive/_verify-topicking-by-row.mjs [baseUrl] [--clean]
 */
const args = process.argv.slice(2)
const BASE = (args.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const CLEAN = args.includes('--clean')
// 测试库 fixture 选择(2026-10-15 实测):
//   MO-2026-09-0006 有 4 行 pl_xc 全 =1,但存在一张**真实的未审核整单级草稿** LL2609280001
//     (工单行号=0,4 行明细)—— 按本类口径「工单级单据视为占整单」,**拦它是正确行为**,
//     不能用作"能转"的样本(首轮探针就是这么误判的)。
//   MO-2026-09-0007 干净:pl_xc=1 一行(行id=31)+ pl_xc=2 两行(行id=32,36),唯一的领料单
//     CL-2026-10-0001 已作废 ⇒ 应可正常按行转。
const WO = 'MO-2026-09-0007'
const EXPECT_ROWS = 3
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
console.log(`账套 = ${login.data.user?.factory}`)
const token = login.data.token
const api = async (path, body) => fetch(`${BASE}/api${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body ?? {}),
}).then((x) => x.json())

// ── 取工单列表的候选行(与前端勾选同源:带 行id) ──
const list = await api('/px/workOrderList', { keyword: WO })
const rows = (list.data || []).filter((r) => String(r['工单号']) === WO)
console.log(`\n    ${WO} 列表命中 ${rows.length} 行 = ` + JSON.stringify(rows.map((r) => ({ 行id: r['行id'], 行号: r['工单行号'], 批次: r['批次号'] }))))
ok('① 列表返回多行且每行有独立 行id', rows.length > 1 && rows.every((r) => r['行id'] != null), `n=${rows.length}`)
ok(`① 行数 = ${EXPECT_ROWS}(fixture 已知)`, rows.length === EXPECT_ROWS, `n=${rows.length}`)
ok('① 存在两行共用同一 工单行号(证明"工单号+行号"不足以区分,只有 行id 能)',
  new Set(rows.map((r) => r['工单行号'])).size < rows.length,
  JSON.stringify(rows.map((r) => ({ 行id: r['行id'], 行号: r['工单行号'], 批次: r['批次号'] }))))

// ── 勾选全部行转领料单 ──
// 用户口径(2026-10-15):「工单号加工单行号作为标识,每个独立进行」⇒ 去重键 = (工单号, 工单行号)。
// 本 fixture 的 3 行里,行id=32 与 36 **共用同一 (工单号,行号)=(MO-2026-09-0007, 2)** ——
// 按用户口径它们是**同一个标识** ⇒ 只应转出 1 张;加上行号1 那张,合计 **2 张**(不是 3 张)。
const uniqKeys = [...new Set(rows.map((r) => `${r['工单号']}#${r['工单行号']}`))]
console.log(`    去重后标识 = ${JSON.stringify(uniqKeys)} (物理行 ${rows.length} 个)`)
const payload = rows.map((r) => ({ 公司代码: r['公司代码'], 工单号: r['工单号'], 行id: r['行id'], 工单行号: r['工单行号'], 批次号: r['批次号'] }))
const res = await api('/px/workOrderList/toPicking', { rows: payload })
const d = res.data || {}
console.log(`    回执 = ${JSON.stringify(d).slice(0, 400)}`)
ok('② 张数 = 不同(工单号,工单行号)标识数(同标识的多物理行只转一张)',
  Number(d['转领料单张数'] || 0) === uniqKeys.length,
  `张数=${d['转领料单张数']} 标识数=${uniqKeys.length} 失败=${JSON.stringify(d['失败行'] || [])}`)
const created = (d['单号清单'] || []).map((s) => String(s).split('→').pop())
console.log(`    生成单号 = ${JSON.stringify(created)}`)

// ── 核对单头是否带 工单行号 ──
const mo = await api('/px/queryFormDataList', { panelCode: 'MATERIAL_OUT', pageNo: 1, pageSize: 200 })
const moRows = (mo.data && (mo.data.rows || mo.data.list || mo.data.items)) || []
const mine = moRows.filter((x) => created.includes(String(x['单据编号'])))
console.log(`    材料出库单列表查到 ${mine.length} 张 = ` + JSON.stringify(mine.map((x) => ({ 单: x['单据编号'], 加工单号: x['加工单号'], 工单行号: x['工单行号'] }))))
ok('③ 每张单头都带 工单行号', mine.length > 0 && mine.every((x) => x['工单行号'] != null),
  JSON.stringify(mine.map((x) => x['工单行号'])))
ok('③ 材料出库单列表含「工单行号」列(用户能看出是哪一行)',
  moRows.length === 0 || '工单行号' in (moRows[0] || {}), JSON.stringify(Object.keys(moRows[0] || {}).slice(0, 16)))

// ── 同一行勾两次只转一张 ──
if (rows.length) {
  const dup = await api('/px/workOrderList/toPicking', { rows: [payload[0], payload[0]] })
  const dd = dup.data || {}
  console.log(`    同行勾两次回执 = ${JSON.stringify(dd).slice(0, 260)}`)
  ok('④ 同一行勾两次只转一张(或按占用链拒绝)', dup.code !== 200 || Number(dd['转领料单张数'] || 0) <= 1,
    `张数=${dd['转领料单张数']}`)
}

// ── 清理:把本探针造的单作废(与界面「删除」同口径:软删 + 状态作废 + 释放占用链) ──
// ⚠ 「删除」按钮只置 yj_doc_status.canceled,**不写业务表 asp_cancel** —— 与报工单同一坑,
//   软删得自己补,否则测试库留下存活草稿。清理 SQL 见 tools/archive/_clean-topicking-probe.sql 同款口径。
if (CLEAN && created.length) {
  for (const n of created) {
    try { await api('/px/callButton', { panelCode: 'MATERIAL_OUT', buttonName: '删除', formData: { 编号: n }, buttonParam: {} }) } catch { /* 忽略 */ }
  }
  console.log(`\n    已按界面「删除」作废 ${created.length} 张:${created.join('、')}`)
  console.log(`    ⚠ 仍需补业务表软删(见 tools/archive/_clean-topicking-probe.sql 的 UPDATE 段)`)
}
console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
