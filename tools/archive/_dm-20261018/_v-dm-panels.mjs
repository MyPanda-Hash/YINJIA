/* 一次性探针(2026-10-18):数据建模两面板的读/写闭环 —— 在真实 8090 上打接口,不打开浏览器。
 *   ① FIELDMGR 字段管理:全量行数、按面板编码筛选、派生列「面板名称」有值;
 *   ② FIELDMGR 保存往返:改一行的「列宽」→ 保存 → 重读 → 复原(证明派生列不参与 UPDATE、且能落库);
 *   ③ ERPLG ERP导入日志:9 个批次、总行数、导入类型。
 * 用法:node tools/archive/_dm-20261018/_v-dm-panels.cjs
 */
const API = 'http://127.0.0.1:8090/api'
const json = async (url, body, headers = {}) => {
  const r = await fetch(API + url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, j, t }
}

const login = await json('/auth/login', { userName: 'admin', password: '123456' })
if (!login.j?.data?.token) { console.log('登录失败:', login.t.slice(0, 200)); process.exit(1) }
const H = { Authorization: 'Bearer ' + login.j.data.token }

const query = (panelCode, condition = {}) =>
  json('/px/queryFormDataList', { panelCode, keyword: '', condition, pageNo: 1, pageSize: 50 }, H)

let fail = 0
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++ }

// ① 全量 + 派生列
const all = await query('FIELDMGR')
if (all.status !== 200) { console.log('FIELDMGR 查询失败:', all.t.slice(0, 400)); process.exit(1) }
const rows = all.j.data.list[0].detail.items
check(all.j.data.totalSize === rows.length && rows.length > 0, `FIELDMGR 全量 ${all.j.data.totalSize} 行`)
const withName = rows.filter((r) => r['面板名称'] && String(r['面板名称']).length > 0)
check(withName.length > 0, `派生列「面板名称」有值 ${withName.length}/${rows.length}(样例:${withName[0]?.['面板编码']} → ${withName[0]?.['面板名称']})`)

// ② 按面板编码筛选
const so = await query('FIELDMGR', { 面板编码: 'SO_ORDER' })
const soRows = so.j.data.list[0].detail.items
check(so.j.data.totalSize > 0 && soRows.every((r) => r['面板编码'] === 'SO_ORDER'),
  `按「面板编码=SO_ORDER」筛选 ${so.j.data.totalSize} 行,全部命中`)
check(soRows.every((r) => r['面板名称'] === '销售订单'), `筛选结果的面板名称均为「销售订单」(${soRows[0]?.['面板名称']})`)

// ③ 保存往返:改列宽 → 存 → 重读 → 复原
const pick = soRows.find((r) => r['字段名'] === '数量' && r['列宽'] != null) || soRows[0]
const id = pick.id, oldW = pick['列宽'], newW = (oldW ?? 100) + 17
const save = async (row) => json('/px/callButton', {
  panelCode: 'FIELDMGR', buttonName: '保存',
  formData: { 编号: '字段管理', detail: { items: [row] } },
  buttonParam: { 只提交改动行: true },
}, H)
const s1 = await save({ ...pick, 列宽: newW })
check(s1.status === 200, `保存一行(id=${id} 列宽 ${oldW}→${newW}):HTTP ${s1.status} ${s1.status === 200 ? '' : s1.t.slice(0, 300)}`)
const back1 = (await query('FIELDMGR', { 面板编码: 'SO_ORDER' })).j.data.list[0].detail.items.find((r) => r.id === id)
check(back1?.['列宽'] === newW, `重读列宽 = ${back1?.['列宽']}(应为 ${newW})`)
check(back1?.['面板名称'] === '销售订单', '保存后派生列「面板名称」仍正确(未被写坏)')
const s2 = await save({ ...back1, 列宽: oldW })
const back2 = (await query('FIELDMGR', { 面板编码: 'SO_ORDER' })).j.data.list[0].detail.items.find((r) => r.id === id)
check(s2.status === 200 && back2?.['列宽'] === oldW, `复原列宽 = ${back2?.['列宽']}(应为 ${oldW})`)

// ④ ERP 导入日志(金蝶关联数据)
// ⚠ ERPLG 是 archive 模式 ⇒ list[0].detail.<tabKey> 装的是**批次头**(erp_imp_log),
//   本面板的 tabKey = erplg(取自 yj_panel.detail_key);行级 erp_imp_row 是另一张面板 ERPLG_ROW。
const erp = await query('ERPLG')
const erpDoc = erp.j.data?.list?.[0] || {}
const erpRows = erpDoc.detail?.erplg || Object.values(erpDoc.detail || {}).find(Array.isArray) || []
check(erp.status === 200 && erp.j.data.totalSize === 9, `ERPLG 批次 ${erp.j.data?.totalSize} 个(应为 9)`)
const types = erpRows.map((r) => r['导入类型']).join(',')
check(types.includes('采购订单') && types.includes('销售订单') && types.includes('商品档案'), `导入类型:${types}`)
const totalLines = erpRows.reduce((s, r) => s + Number(r['总行数'] || 0), 0)
check(totalLines > 10000, `合计导入行数 ${totalLines}`)
const ops = [...new Set(erpRows.map((r) => r['操作人']))].join(',')
check(ops.includes('金蝶同步'), `操作人:${ops}`)

console.log(fail ? `\n${fail} 项未通过` : '\n全部通过')
process.exit(fail ? 1 : 0)
